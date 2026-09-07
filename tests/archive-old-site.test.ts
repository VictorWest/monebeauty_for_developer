import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("scripts/archive-old-site.mjs", "utf8");

test("legacy archive is staged and validates canonical locale/product parity", () => {
  assert.match(script, /EXPECTED_PAGES = 153/);
  assert.match(script, /EXPECTED_PER_LOCALE = 51/);
  assert.match(script, /EXPECTED_PRODUCTS_PER_LOCALE = 31/);
  assert.match(script, /Locale route parity failed/);
  assert.match(script, /incomplete page/);
  assert.match(script, /renameSync\(STAGE, TARGET\)/);
  assert.match(script, /renameSync\(BACKUP, TARGET\)/);
});

test("legacy archive preserves full Markdown and manifests every media reference", () => {
  assert.doesNotMatch(script, /maximumWords|wordLimit|slice\(0,\s*60\)/);
  assert.match(script, /page-manifest\.json/);
  assert.match(script, /url-manifest\.json/);
  assert.match(script, /media-reference-manifest\.json/);
  assert.match(script, /Media-reference manifest coverage failed/);
  assert.match(script, /sha256/);
  assert.match(script, /response\.status === 200/);
});

test("current local archive passes the committed crawler contract when present", () => {
  if (!existsSync("scraped_content/page-manifest.json")) return;
  const pages = JSON.parse(
    readFileSync("scraped_content/page-manifest.json", "utf8"),
  ) as Array<{
    locale: "fi" | "en" | "ru";
    product: boolean;
    rawSize: number;
    markdownSize: number;
  }>;
  const resources = JSON.parse(
    readFileSync("scraped_content/url-manifest.json", "utf8"),
  ) as Array<{ requestedUrl: string; status: number }>;
  const references = JSON.parse(
    readFileSync("scraped_content/media-reference-manifest.json", "utf8"),
  ) as Array<{ url: string }>;

  assert.equal(pages.length, 153);
  for (const locale of ["fi", "en", "ru"] as const) {
    assert.equal(pages.filter((page) => page.locale === locale).length, 51);
    assert.equal(
      pages.filter((page) => page.locale === locale && page.product).length,
      31,
    );
  }
  assert.ok(pages.every((page) => page.rawSize > 0 && page.markdownSize > 0));
  assert.ok(
    references.every((reference) =>
      resources.some((resource) => resource.requestedUrl === reference.url),
    ),
  );
  assert.deepEqual(
    resources
      .filter((resource) => resource.status !== 200)
      .map((resource) => resource.requestedUrl),
    ["https://monebeauty.fi/i/icon__slider-next.svg"],
  );
});
