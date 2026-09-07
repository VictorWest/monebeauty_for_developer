// Generates committed content registries from the scraped live site.
// Source: ../scraped_content/{en,fi,ru}/*.md  (git-ignored reference)
// Output: ../content/generated/{pages,products,assets}.json  (committed)
// Image srcs are rewritten /files -> /media/files and /images -> /media/images.
//
// Run: node scripts/gen-content.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCRAPED = path.join(ROOT, "scraped_content");
const OUT = path.join(ROOT, "content", "generated");
const LOCALES = ["en", "fi", "ru"];
const LASER_PAGE_IMAGES = [
  "/media/clinic/laser/laser-forearm-hair-removal.jpeg",
  "/media/clinic/laser/laser-face-hair-removal.jpeg",
  "/media/clinic/laser/laser-bikini-hair-removal.jpeg",
  "/media/clinic/laser/laser-full-leg-hair-removal.jpeg",
  "/media/clinic/laser/laser-neck-hair-removal.jpeg",
  "/media/clinic/laser/laser-underarm-hair-removal.jpeg",
  "/media/clinic/laser/laser-lower-body-hair-removal.jpeg",
  "/media/clinic/laser/laser-chin-hair-removal.jpeg",
  "/media/clinic/laser/laser-upper-body-hair-removal.jpeg",
];

const PAGES = [
  { slug: "about", file: "about" },
  { slug: "instrumental/endosphere", file: "instrumental-endosphere" },
  { slug: "instrumental/laser", file: "instrumental-laser" },
  { slug: "instrumental/mikroneulanrf", file: "instrumental-mikroneulanrf" },
  { slug: "trichology", file: "trichology" },
  { slug: "arosha", file: "arosha" },
  { slug: "services", file: "services-index" },
  { slug: "services/face", file: "services-face" },
  { slug: "services/body", file: "services-body" },
  { slug: "services/tricho", file: "services-tricho" },
  { slug: "services/laser", file: "services-laser" },
  { slug: "services/mikroneulanrf", file: "services-mikroneulanrf" },
  { slug: "services/eyebrows", file: "services-eyebrows" },
  { slug: "services/packages", file: "services-packages" },
  { slug: "services/gift-cards", file: "services-gift-cards" },
];

const assets = new Set();

function readMd(file) {
  return fs.readFileSync(file, "utf8");
}

// SCOPE.md: brand renamed "Mone Beauty Club" -> "Mone Beauty Clinic". Applied to all
// generated copy. Finnish inflected forms present in the scrape (Clubiin/Clubin) are
// mapped first so the bare "Club" rule doesn't mangle them.
function renameBrand(text) {
  if (!text) return text;
  return text
    .replace(/Beauty Clubiin/g, "Beauty Cliniciin")
    .replace(/Beauty Clubin/g, "Beauty Clinicin")
    .replace(/Beauty Clubilla/g, "Beauty Clinicillä")
    .replace(/Beauty Club/g, "Beauty Clinic");
}

function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const fm = {};
  let body = md;
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      // The archive quotes its YAML values. Keeping the quote characters made
      // every page title literally `"Body treatments in Helsinki"`, which both
      // rendered the quotes and defeated the `in Helsinki` suffix strip on the
      // service cards, because the string no longer ended in "Helsinki".
      if (kv) fm[kv[1]] = kv[2].trim().replace(/^"(.*)"$/s, "$1");
    }
    body = md.slice(m[0].length);
  }
  return { fm, body };
}

function collectAssets(text) {
  for (const m of text.matchAll(/\((\/(?:files|images)\/[^)\s]+)\)/g)) {
    assets.add(m[1].replace(/^\//, "")); // e.g. files/land/78/x.jpg
  }
}

function rewriteImages(text) {
  return text
    .replace(/\(\/files\//g, "(/media/files/")
    .replace(/\(\/images\//g, "(/media/images/");
}

// Client-approved photography replaces the nine archive images in every localized laser
// technology page. Position-based replacement is intentional because the translated scrapes
// use different file names while retaining the same page structure.
function applyClientMedia(slug, text) {
  if (slug !== "instrumental/laser") return text;
  let imageIndex = 0;
  return text.replace(
    /(!\[[^\]]*\]\()\/media\/[^)\s]+(\))/g,
    (match, opening, closing) => {
      const image = LASER_PAGE_IMAGES[imageIndex++];
      return image ? `${opening}${image}${closing}` : match;
    },
  );
}

function firstImage(text) {
  const m = text.match(/!\[[^\]]*\]\((\/media\/[^)\s]+)\)/);
  return m ? m[1] : null;
}

function cleanBody(body, title) {
  // Cut trailing "## Media" section.
  const mediaIdx = body.indexOf("\n## Media");
  if (mediaIdx !== -1) body = body.slice(0, mediaIdx);
  body = body.trim();
  // Drop a leading duplicate H1 equal to the frontmatter title. Compared on
  // normalized text: the about page writes its heading as `# **Welcome to Mone
  // Beauty Club!**`, so an exact match left the emphasized copy in the body and
  // every locale rendered the page title twice.
  if (title) {
    const normalize = (value) =>
      value
        .replace(/\*\*|__|[*_`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const heading = body.match(/^#\s+([^\n]+)\n*/);
    if (heading && normalize(heading[1]) === normalize(title))
      body = body.slice(heading[0].length);
  }
  return body.trim();
}

// ---- Pages ----
const pages = {};
for (const { slug, file } of PAGES) {
  pages[slug] = {};
  for (const loc of LOCALES) {
    const p = path.join(SCRAPED, loc, `${file}.md`);
    if (!fs.existsSync(p)) continue;
    const { fm, body: raw } = parseFrontmatter(readMd(p));
    collectAssets(raw.split("\n## Media")[0]);
    const body = applyClientMedia(
      slug,
      rewriteImages(renameBrand(cleanBody(raw, fm.title))),
    );
    pages[slug][loc] = {
      title: renameBrand(fm.title ?? ""),
      hero: firstImage(body),
      body,
    };
  }
}

// ---- Products ----
function classify(slug) {
  return /dixidox|crexepil|fresh-cells|science-7/.test(slug)
    ? "DIXIDOX_TRICHO"
    : "AROSHA_BODY";
}

const productFiles = fs
  .readdirSync(path.join(SCRAPED, "en", "catalog"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""));

const products = [];
for (const slug of productFiles) {
  const entry = {
    slug,
    category: classify(slug),
    image: null,
    price: null,
    size: null,
    i18n: {},
  };
  for (const loc of LOCALES) {
    const p = path.join(SCRAPED, loc, "catalog", `${slug}.md`);
    if (!fs.existsSync(p)) continue;
    const { fm, body } = parseFrontmatter(readMd(p));
    const main = body.split("\n## Media")[0];
    collectAssets(main);
    // Structure: [hero] ## <Description> ... ## <See also> ...
    // Only the hero block describes this product. Splitting on the literal
    // "## See also" left the whole cross-sell list attached in Finnish and
    // Russian, whose headings read "Katso myös" and "Смотрите также", so the
    // price and size below were read off a neighbouring product: seven products
    // shipped a size their own page never stated. Sections are taken by
    // position instead, which is language-agnostic.
    const parts = main.split(/\n##\s+/);
    const hero = parts[0];
    // image (first /images/photo)
    const img = hero.match(/\((\/images\/[^)\s]+)\)/);
    if (img && !entry.image)
      entry.image = img[1].replace(/^\/images\//, "/media/images/");
    const price = hero.match(/([\d]+[.,]\d{2})\s*€/);
    if (price && !entry.price)
      entry.price = parseFloat(price[1].replace(",", "."));
    const size = hero.match(
      /\n\s*(\d+(?:[.,]\d+)?\s*ml|\d+\s*(?:phials|pcs)?)\s*\n/i,
    );
    if (size && !entry.size) entry.size = size[1].trim();
    // Description: every "## " section from the first one up to the trailing
    // cross-sell block.
    //
    // Taking only the first section assumed the whole body sits under a single
    // "## Description". English and Finnish do that, with `###` subheadings, but
    // the Russian pages open a *second* `##` immediately after "## Описание", so
    // the first section was nothing but its own heading: four Russian products
    // shipped an entirely empty description and a fifth lost its instructions.
    const isCrossSell = (section) =>
      (section.match(/\]\(\/(?:[A-Z]{2}\/)?catalog\//g) ?? []).length >= 2;
    const sections = [];
    for (const section of parts.slice(1)) {
      if (isCrossSell(section)) break;
      sections.push(section);
    }
    const desc = sections
      .map((section, sectionIndex) => {
        const nl = section.indexOf("\n");
        const heading = (nl === -1 ? section : section.slice(0, nl)).trim();
        const rest = (nl === -1 ? "" : section.slice(nl + 1)).trim();
        // The first heading is the generic "Description" label, which the page
        // template supplies; later headings are the product's own copy.
        return sectionIndex === 0 ? rest : `## ${heading}\n\n${rest}`.trim();
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();
    entry.i18n[loc] = {
      name: renameBrand(fm.title ?? slug),
      description: renameBrand(desc),
    };
  }
  products.push(entry);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "pages.json"), JSON.stringify(pages, null, 2));
fs.writeFileSync(
  path.join(OUT, "products.json"),
  JSON.stringify(products, null, 2),
);
fs.writeFileSync(
  path.join(OUT, "assets.json"),
  JSON.stringify([...assets].sort(), null, 2),
);

console.log(
  `pages: ${Object.keys(pages).length}, products: ${products.length}, assets referenced: ${assets.size}`,
);
