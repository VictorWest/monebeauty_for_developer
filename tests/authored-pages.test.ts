import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { AUTHORED_PAGES } from "../content/authored-pages";
import { getPageContent } from "../content/pages";
import type { Locale } from "../i18n/routing";

const locales: Locale[] = ["en", "fi", "ru"];
const slugs = ["services/injectable", "services/consultation"];
const syncScript = readFileSync("scripts/sync-cms-from-generated.ts", "utf8");
const generated = readFileSync("content/generated/pages.json", "utf8");

test("the SCOPE services have authored copy in all three locales", () => {
  for (const slug of slugs)
    for (const locale of locales) {
      const page = AUTHORED_PAGES[slug]?.[locale];
      assert.ok(page, `${slug}/${locale} is missing`);
      assert.ok(page.title.trim(), `${slug}/${locale} has no title`);
      assert.ok(
        page.body.trim().length > 400,
        `${slug}/${locale} body is too thin to publish`,
      );
    }
});

test("authored copy is merged into the page registry the app reads", () => {
  for (const slug of slugs)
    for (const locale of locales)
      assert.ok(
        getPageContent(slug, locale),
        `${slug}/${locale} is not reachable via getPageContent`,
      );
});

test("authored copy stays out of the generated registry", () => {
  // `scripts/gen-content.mjs` rewrites pages.json wholesale, so hand-authored copy kept
  // there would vanish on the next regeneration.
  for (const slug of slugs)
    assert.doesNotMatch(generated, new RegExp(`"${slug}"`), slug);
  assert.match(syncScript, /\.\.\.AUTHORED_PAGES/);
});

test("clinical specifics are left for the clinic, not drafted", () => {
  // The content-sourcing rule: process and logistics may be authored, but named procedures,
  // indications, contraindications, outcomes and prices must stay [CLINIC TO PROVIDE].
  for (const slug of slugs)
    for (const locale of locales) {
      const body = AUTHORED_PAGES[slug]![locale]!.body;
      assert.match(
        body,
        /\[CLINIC TO PROVIDE\]/,
        `${slug}/${locale} states clinical detail with no clinic-review marker`,
      );
      // A drafted price would read as a real one; prices are never ours to invent.
      assert.doesNotMatch(
        body,
        /\d\s*€|€\s*\d/u,
        `${slug}/${locale} contains a drafted price`,
      );
    }
});

test("neither page opens with an h1 or parses into treatment cards", () => {
  // `Markdown.tsx` demotes h1 and the page template supplies the only <h1>; `####` headings
  // would be parsed as priced procedure cards by lib/procedures.ts.
  for (const slug of slugs)
    for (const locale of locales) {
      const body = AUTHORED_PAGES[slug]![locale]!.body;
      assert.doesNotMatch(body, /^#\s/mu, `${slug}/${locale} has a body h1`);
      assert.doesNotMatch(
        body,
        /^####\s/mu,
        `${slug}/${locale} would render as treatment cards`,
      );
    }
});

test("the consultation hero is a committed clinic photo, not stock", () => {
  const image = syncScript.match(/"(\/media\/clinic\/[^"]+)"/)?.[1];
  assert.ok(image, "consultation is not wired to its hero image");
  assert.equal(existsSync(`public${image}`), true, `${image} is not committed`);
});
