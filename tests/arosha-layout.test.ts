import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAroshaMarkdown } from "../lib/arosha-layout";

type Locale = "en" | "fi" | "ru";
type GeneratedPages = Record<
  string,
  Record<Locale, { title: string; hero: string | null; body: string }>
>;

const pages = JSON.parse(
  readFileSync("content/generated/pages.json", "utf8"),
) as GeneratedPages;
const component = readFileSync("components/arosha/AroshaPage.tsx", "utf8");
const route = readFileSync("app/(public)/[locale]/arosha/page.tsx", "utf8");
const LOCALES = ["en", "fi", "ru"] as const;

const layoutFor = (locale: Locale) =>
  parseAroshaMarkdown(pages["arosha"][locale].body);

/** Headings and bold runs are stripped for display, so compare on the text. */
const normalize = (block: string) =>
  block
    .replace(/^#{1,6}\s+/u, "")
    .replace(/\*\*/gu, "")
    .replace(/\s*\/\s*$/u, "")
    .trim();

test("the Arosha layout places every block of published copy", () => {
  for (const locale of LOCALES) {
    const layout = layoutFor(locale);
    const placed = new Set(
      [
        layout.lead,
        ...layout.intro,
        ...(layout.specHeading ? [layout.specHeading] : []),
        ...layout.specs.flatMap((spec) => [spec.label, spec.value]),
        ...(layout.programsHeading ? [layout.programsHeading] : []),
        ...layout.programs.flatMap((program) => [
          program.name,
          ...program.body,
          ...(program.price ? [program.price] : []),
        ]),
        ...(layout.closingHeading ? [layout.closingHeading] : []),
        ...layout.closing,
        ...layout.dropped,
      ].map(normalize),
    );
    const missing = layout.orderedTextBlocks.filter(
      (block) => !placed.has(normalize(block)),
    );
    assert.deepEqual(missing, [], `${locale} left copy unplaced`);
  }
});

test("the seven skincare programs keep their own prices", () => {
  for (const locale of LOCALES) {
    const layout = layoutFor(locale);
    assert.equal(layout.programs.length, 7, locale);
    for (const program of layout.programs) {
      assert.ok(program.name, locale);
      assert.ok(program.body.length, `${locale} ${program.name} lost its copy`);
      assert.match(program.price ?? "", /\d/u, `${locale} ${program.name}`);
    }
    // "Super Combo 1" ends in a digit; reading it as the previous program's
    // price swallowed three programs and their descriptions.
    const named = layout.programs.map((program) => program.name);
    assert.ok(
      named.some((name) => /Super Combo 1/u.test(name)),
      locale,
    );
    assert.deepEqual(
      layout.programs.slice(0, 4).map((program) => program.price),
      Array(4).fill(layout.programs[0].price),
      `${locale} single programs should share one price`,
    );
  }
});

test("the flattened spec table is paired back into label and value rows", () => {
  for (const locale of LOCALES) {
    const layout = layoutFor(locale);
    assert.equal(layout.specs.length, 7, locale);
    for (const spec of layout.specs) {
      assert.ok(spec.label.length > 0 && spec.label.length < 60, locale);
      assert.ok(spec.value.length > 0, `${locale} ${spec.label} has no value`);
    }
  }
  assert.match(component, /<dl/u);
  assert.match(component, /<dt/u);
  assert.match(component, /<dd/u);
});

test("the previous site's cart and form controls are dropped, not rendered", () => {
  for (const locale of LOCALES) {
    const layout = layoutFor(locale);
    // One add-to-cart control per program, plus the form's submit label.
    assert.equal(layout.dropped.length, layout.programs.length + 1, locale);
    for (const block of layout.dropped) {
      assert.ok(block.length < 40, `${locale} dropped real copy: ${block}`);
    }
  }
});

test("Arosha renders its own layout with the registered hero", () => {
  assert.match(route, /<AroshaPage/u);
  assert.doesNotMatch(route, /<ContentPage/u);
  assert.match(component, /content\.hero/u);
  assert.match(component, /fill\s+priority/u);
  // Count markup only; the file's own comments describe the old layout.
  const markup = component.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.equal((markup.match(/<h1/gu) ?? []).length, 1);
  assert.doesNotMatch(component, /line-clamp|truncate/u);
});

test("the hero lead is lifted out of the body rather than repeated", () => {
  for (const locale of LOCALES) {
    const layout = layoutFor(locale);
    assert.ok(layout.lead.length > 40, locale);
    assert.ok(!layout.intro.includes(layout.lead), `${locale} printed it twice`);
  }
});
