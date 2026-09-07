import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import TurndownService from "turndown";

const ORIGIN = "https://monebeauty.fi";
const EXPECTED_PAGES = 153;
const EXPECTED_PER_LOCALE = 51;
const EXPECTED_PRODUCTS_PER_LOCALE = 31;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(ROOT, "scraped_content");
const STAGE = join(ROOT, `.scraped_content.stage-${process.pid}`);
const BACKUP = join(ROOT, `.scraped_content.backup-${process.pid}`);
const SCRAPED_AT = new Date().toISOString().slice(0, 10);
const USER_AGENT = "MoneBeautyArchive/1.0 (+https://monebeauty.fi)";
const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const ensureParent = (file) => mkdirSync(dirname(file), { recursive: true });
const write = (file, value) => {
  ensureParent(file);
  writeFileSync(file, value);
};

async function fetchResource(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT },
    });
    const body = Buffer.from(await response.arrayBuffer());
    return {
      requestedUrl: url,
      finalUrl: response.url,
      status: response.status,
      mimeType: response.headers.get("content-type")?.split(";")[0] ?? "",
      body,
      size: body.length,
      sha256: sha256(body),
    };
  } catch (error) {
    return {
      requestedUrl: url,
      finalUrl: url,
      status: 0,
      mimeType: "",
      body: Buffer.alloc(0),
      size: 0,
      sha256: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/giu)].map((match) =>
    match[1].replaceAll("&amp;", "&"),
  );
}

function canonicalUrl(value) {
  const url = new URL(value, ORIGIN);
  url.hash = "";
  if (url.origin !== ORIGIN) return null;
  return url.href.replace(/\/$/u, "") || `${ORIGIN}/`;
}

function pageIdentity(urlValue) {
  const url = new URL(urlValue);
  const parts = url.pathname.split("/").filter(Boolean);
  const locale = parts[0] === "EN" ? "en" : parts[0] === "RU" ? "ru" : "fi";
  if (locale !== "fi") parts.shift();
  const route = `/${parts.join("/")}${parts.length ? "/" : ""}`;
  const product = parts[0] === "catalog" && parts[1]?.endsWith(".html");
  let output;
  if (!parts.length) output = "home.md";
  else if (product) output = `catalog/${parts[1].replace(/\.html$/u, "")}.md`;
  else if (
    parts.length === 1 &&
    ["services", "catalog", "instrumental"].includes(parts[0])
  )
    output = `${parts[0]}-index.md`;
  else output = `${parts.join("-")}.md`;
  return { locale, route, output, product };
}

function yaml(value) {
  return JSON.stringify(String(value));
}

function semanticMarkdown(html) {
  const root = parse(html);
  for (const selector of [
    "script",
    "style",
    "noscript",
    "header",
    "footer",
    "nav",
    ".cookie",
    ".popup",
    ".modal",
  ])
    root.querySelectorAll(selector).forEach((node) => node.remove());
  const content =
    root.querySelector("main") ??
    root.querySelector('[role="main"]') ??
    root.querySelector("body");
  if (!content) return "";
  return turndown
    .turndown(content.innerHTML)
    .replace(/\\([.!])/gu, "$1")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function titleFromHtml(html) {
  const root = parse(html);
  return (
    root.querySelector("h1")?.textContent ??
    root.querySelector("title")?.textContent ??
    ""
  )
    .replace(/\s+/gu, " ")
    .trim();
}

function urlsFromCss(value, base) {
  return [...value.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/giu)]
    .map((match) => absoluteAsset(match[1], base))
    .filter(Boolean);
}

function absoluteAsset(value, base) {
  if (!value || /^(?:data:|blob:|mailto:|tel:|javascript:|#)/iu.test(value))
    return null;
  try {
    const url = new URL(value, base);
    if (url.origin !== ORIGIN) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function pageReferences(html, pageUrl) {
  const root = parse(html);
  const refs = new Set();
  for (const node of root.querySelectorAll("img,source,video,audio,link")) {
    for (const attribute of ["src", "poster", "href"]) {
      const value = node.getAttribute(attribute);
      const url = absoluteAsset(value, pageUrl);
      if (
        url &&
        (node.tagName !== "LINK" ||
          /stylesheet|preload|icon/iu.test(node.getAttribute("rel") ?? ""))
      )
        refs.add(url);
    }
    for (const candidate of (node.getAttribute("srcset") ?? "").split(",")) {
      const url = absoluteAsset(candidate.trim().split(/\s+/u)[0], pageUrl);
      if (url) refs.add(url);
    }
  }
  for (const node of root.querySelectorAll("[style]"))
    for (const url of urlsFromCss(node.getAttribute("style") ?? "", pageUrl))
      refs.add(url);
  return [...refs];
}

function pageLinks(html, pageUrl) {
  const root = parse(html);
  return root
    .querySelectorAll("a[href]")
    .map((node) =>
      canonicalUrl(new URL(node.getAttribute("href"), pageUrl).href),
    )
    .filter(Boolean);
}

function assetPath(urlValue) {
  const url = new URL(urlValue);
  let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!pathname || pathname.endsWith("/")) pathname += "index";
  if (url.search) {
    const extension = pathname.match(/(\.[^./]+)$/u)?.[1] ?? "";
    const basename = extension
      ? pathname.slice(0, -extension.length)
      : pathname;
    pathname = `${basename}-${sha256(url.search).slice(0, 10)}${extension}`;
  }
  return `assets/${pathname}`;
}

async function concurrent(values, limit, task) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        results[index] = await task(values[index], index);
      }
    }),
  );
  return results;
}

function validatePages(pages) {
  if (pages.length !== EXPECTED_PAGES)
    throw new Error(
      `Expected ${EXPECTED_PAGES} canonical pages, found ${pages.length}`,
    );
  for (const locale of ["fi", "en", "ru"]) {
    const localized = pages.filter((page) => page.locale === locale);
    const products = localized.filter((page) => page.product);
    if (localized.length !== EXPECTED_PER_LOCALE)
      throw new Error(
        `${locale}: expected ${EXPECTED_PER_LOCALE} pages, found ${localized.length}`,
      );
    if (products.length !== EXPECTED_PRODUCTS_PER_LOCALE)
      throw new Error(
        `${locale}: expected ${EXPECTED_PRODUCTS_PER_LOCALE} products, found ${products.length}`,
      );
  }
  const parity = (locale) =>
    pages
      .filter((page) => page.locale === locale)
      .map((page) => page.route)
      .sort()
      .join("\n");
  if (parity("fi") !== parity("en") || parity("fi") !== parity("ru"))
    throw new Error("Locale route parity failed");
  for (const page of pages) {
    if (page.status !== 200 || !page.rawSize || !page.markdownSize)
      throw new Error(
        `${page.url}: incomplete page (${page.status}, raw ${page.rawSize}, markdown ${page.markdownSize})`,
      );
  }
}

async function main() {
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });
  const index = await fetchResource(`${ORIGIN}/sitemap_index.xml`);
  if (index.status !== 200)
    throw new Error(`Sitemap index HTTP ${index.status}`);
  const sitemapLocation = sitemapUrls(index.body.toString("utf8"))[0];
  const compressed = await fetchResource(sitemapLocation);
  if (compressed.status !== 200)
    throw new Error(`Sitemap HTTP ${compressed.status}`);
  const { gunzipSync } = await import("node:zlib");
  const sitemapBody = sitemapLocation.endsWith(".gz")
    ? gunzipSync(compressed.body).toString("utf8")
    : compressed.body.toString("utf8");
  const urls = [
    ...new Set(sitemapUrls(sitemapBody).map(canonicalUrl).filter(Boolean)),
  ];
  const sitemapSet = new Set(urls);
  const mediaByPage = new Map();
  const pages = await concurrent(urls, 8, async (url) => {
    const response = await fetchResource(url);
    const html = response.body.toString("utf8");
    const identity = pageIdentity(url);
    const rawRelative = `_raw/${identity.locale}/${identity.output.replace(/\.md$/u, ".html")}`;
    const markdownRelative = `${identity.locale}/${identity.output}`;
    const markdown = semanticMarkdown(html);
    const references = pageReferences(html, url);
    mediaByPage.set(url, references);
    write(join(STAGE, rawRelative), response.body);
    const document = `---\nsource_url: ${yaml(url)}\nlocale: ${identity.locale}\nroute: ${yaml(identity.route)}\nscraped: ${yaml(SCRAPED_AT)}\ntitle: ${yaml(titleFromHtml(html))}\n---\n\n${markdown}\n\n## Media\n\n${references.map((item) => `- ${item}`).join("\n") || "_None referenced._"}\n`;
    write(join(STAGE, markdownRelative), document);
    return {
      ...identity,
      url,
      finalUrl: response.finalUrl,
      status: response.status,
      mimeType: response.mimeType,
      rawPath: rawRelative,
      markdownPath: markdownRelative,
      rawSize: response.size,
      markdownSize: Buffer.byteLength(document),
      sha256: response.sha256,
      discoveredCanonicalLinks: pageLinks(html, url).filter((item) =>
        sitemapSet.has(item),
      ).length,
    };
  });
  validatePages(pages);

  const referenceRows = [];
  const resourceToPages = new Map();
  for (const [page, references] of mediaByPage)
    for (const url of references) {
      referenceRows.push({ page, url });
      const owners = resourceToPages.get(url) ?? new Set();
      owners.add(page);
      resourceToPages.set(url, owners);
    }
  const resources = [];
  const pending = [...resourceToPages.keys()];
  const seen = new Set(pending);
  while (pending.length) {
    const batch = pending.splice(0, 16);
    const fetched = await concurrent(batch, 8, fetchResource);
    for (const response of fetched) {
      const localPath = assetPath(response.requestedUrl);
      if (response.status === 200 && response.body.length)
        write(join(STAGE, localPath), response.body);
      resources.push({
        ...response,
        body: undefined,
        localPath: response.status === 200 ? localPath : "",
      });
      if (response.status === 200 && response.mimeType === "text/css") {
        for (const nested of urlsFromCss(
          response.body.toString("utf8"),
          response.finalUrl,
        )) {
          if (seen.has(nested)) continue;
          seen.add(nested);
          pending.push(nested);
          resourceToPages.set(
            nested,
            new Set(resourceToPages.get(response.requestedUrl) ?? []),
          );
        }
      }
    }
  }
  for (const [resource, owners] of resourceToPages)
    for (const page of owners)
      if (
        !referenceRows.some((row) => row.page === page && row.url === resource)
      )
        referenceRows.push({ page, url: resource });
  if (
    referenceRows.some(
      (row) => !resources.some((resource) => resource.requestedUrl === row.url),
    )
  )
    throw new Error("Media-reference manifest coverage failed");

  write(
    join(STAGE, "page-manifest.json"),
    `${JSON.stringify(pages, null, 2)}\n`,
  );
  write(
    join(STAGE, "url-manifest.json"),
    `${JSON.stringify(resources, null, 2)}\n`,
  );
  write(
    join(STAGE, "media-reference-manifest.json"),
    `${JSON.stringify(referenceRows, null, 2)}\n`,
  );
  write(
    join(STAGE, "page-manifest.csv"),
    `locale,route,url,status,mime_type,raw_path,markdown_path,raw_size,markdown_size,sha256\n${pages.map((page) => [page.locale, page.route, page.url, page.status, page.mimeType, page.rawPath, page.markdownPath, page.rawSize, page.markdownSize, page.sha256].map(csv).join(",")).join("\n")}\n`,
  );
  write(
    join(STAGE, "url-manifest.csv"),
    `url,final_url,http_status,mime_type,size,sha256,local_path,error\n${resources.map((item) => [item.requestedUrl, item.finalUrl, item.status, item.mimeType, item.size, item.sha256, item.localPath, item.error ?? ""].map(csv).join(",")).join("\n")}\n`,
  );
  write(
    join(STAGE, "media-reference-manifest.csv"),
    `page_url,media_url\n${referenceRows.map((item) => [item.page, item.url].map(csv).join(",")).join("\n")}\n`,
  );
  write(
    join(STAGE, "_tool", "README.md"),
    `# Legacy archive\n\nGenerated by \`npm run content:archive-old-site\` on ${SCRAPED_AT}. The tracked script stages and validates all 153 canonical pages before replacing this ignored directory.\n`,
  );

  if (existsSync(BACKUP)) rmSync(BACKUP, { recursive: true, force: true });
  if (existsSync(TARGET)) renameSync(TARGET, BACKUP);
  try {
    renameSync(STAGE, TARGET);
    rmSync(BACKUP, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(BACKUP) && !existsSync(TARGET)) renameSync(BACKUP, TARGET);
    throw error;
  }
  const broken = resources.filter((item) => item.status !== 200).length;
  console.log(
    `Archived ${pages.length} pages (${EXPECTED_PER_LOCALE} per locale), ${resources.length} resources, ${broken} broken resource(s).`,
  );
}

main().catch((error) => {
  if (existsSync(STAGE)) rmSync(STAGE, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
