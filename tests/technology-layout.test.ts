import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseTechnologyMarkdown,
  plainText,
  sourceHeadingText,
  type TechnologyLayout,
} from "../lib/technology-layout";

type Locale = "en" | "fi" | "ru";
type GeneratedPages = Record<
  string,
  Record<Locale, { title: string; hero: string | null; body: string }>
>;

const pages = JSON.parse(
  readFileSync("content/generated/pages.json", "utf8"),
) as GeneratedPages;
const component = readFileSync(
  "components/technology/TechnologyEditorial.tsx",
  "utf8",
);

const LOCALES = ["en", "fi", "ru"] as const;
/** Every page whose body follows the legacy technology grammar. */
const PAGES = [
  "instrumental/endosphere",
  "instrumental/laser",
  "instrumental/mikroneulanrf",
  "trichology",
] as const;

function layoutFor(page: string, locale: Locale) {
  return parseTechnologyMarkdown(pages[page][locale].body);
}

function usedText(layout: TechnologyLayout) {
  return [
    layout.heroLead,
    ...layout.intro,
    ...layout.overview,
    ...layout.benefits.flatMap((chapter) => [chapter.heading, ...chapter.body]),
    ...(layout.booking ? [layout.booking] : []),
    ...layout.safety.flatMap((chapter) => [chapter.heading, ...chapter.body]),
    ...layout.stages.flatMap((chapter) => [chapter.heading, ...chapter.body]),
    ...layout.sensorChapters.flatMap((chapter) => [
      chapter.heading,
      ...chapter.body,
    ]),
    ...layout.fallback,
  ];
}

test("every technology layout preserves its original localized text blocks", () => {
  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const layout = layoutFor(page, locale);
      const where = `${page} ${locale}`;
      assert.deepEqual(
        usedText(layout).sort(),
        [...layout.orderedTextBlocks].sort(),
        `${where} copy changed or disappeared`,
      );
      assert.equal(layout.fallback.length, 0, `${where} left copy unplaced`);
      assert.equal(layout.safety.length, 2, where);
      assert.ok(layout.benefits.length >= 6, where);
      assert.ok(layout.sensor, where);
    }
  }
});

test("the intro splits into a title, its list groups, and prose without losing a block", () => {
  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const layout = layoutFor(page, locale);
      const where = `${page} ${locale}`;
      const placed = [
        ...(layout.introTitle ? [layout.introTitle] : []),
        ...layout.introGroups.flatMap((group) => [
          group.leadIn,
          ...group.items,
        ]),
        ...layout.introNarrative,
      ];
      // `intro[0]` is the section heading, rendered separately.
      assert.deepEqual(
        placed.sort(),
        [...layout.intro.slice(1)].sort(),
        `${where} dropped an intro block`,
      );
      assert.ok(layout.introGroups.length >= 1, `${where} found no key points`);
    }
  }
});

test("numbered protocol steps are found however the source numbers them", () => {
  // "1 Stage" (endospheres), "1. Consultation" (laser) and "Step 1" (RF) are the
  // three shapes in the copy; matching only a leading numeral missed RF outright.
  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const layout = layoutFor(page, locale);
      assert.equal(layout.stages.length, 4, `${page} ${locale}`);
    }
  }
});

test("the closing device section keeps every chapter it contains", () => {
  // Russian laser copy writes "На лице:" and "На теле:" as headings where the
  // other locales use bold text, so keeping only the first chapter dropped two
  // published sections.
  const laserRu = layoutFor("instrumental/laser", "ru");
  assert.equal(laserRu.sensorChapters.length, 3);
  assert.equal(laserRu.sensorChapters[0], laserRu.sensor);
  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const layout = layoutFor(page, locale);
      assert.ok(layout.sensorChapters.length >= 1, `${page} ${locale}`);
    }
  }
});

test("hero leads read as written instead of as a truncated excerpt", () => {
  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const layout = layoutFor(page, locale);
      const where = `${page} ${locale}`;
      assert.ok(layout.heroLead.length > 80, where);
      assert.doesNotMatch(layout.heroLead, /…$/u, where);
      assert.doesNotMatch(layout.heroLead, /^#{1,6}\s/u, where);
    }
  }
});

test("every call to action leaves the previous site's booking URL behind", () => {
  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const layout = layoutFor(page, locale);
      const where = `${page} ${locale}`;
      // The clinic's own wording is kept; only the dead destination is dropped.
      assert.ok(layout.bookingLabel, `${where} lost the call to action`);
      assert.ok(layout.booking?.includes(layout.bookingLabel as string), where);
      assert.equal(
        layout.bookingHref,
        null,
        `${where} still points at the previous site`,
      );
    }
  }
  // Microneedle RF links absolutely to the old domain, which would take a
  // visitor off this site entirely.
  const rf = layoutFor("instrumental/mikroneulanrf", "en");
  assert.match(rf.booking ?? "", /https:\/\/monebeauty\.fi/u);
  assert.match(component, /PUBLIC_PATHS\.booking/u);
  assert.doesNotMatch(component, /monebeauty\.fi|\/EN\/booking|\/RU\/booking/u);
});

test("the layout publishes the source imagery instead of the first frame", () => {
  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const layout = layoutFor(page, locale);
      const where = `${page} ${locale}`;
      // The page used to render one overview photo and one process photo and
      // discard the rest; every supplied frame now has somewhere to go.
      assert.ok(layout.overviewImages.length >= 3, where);
      assert.ok(
        layout.processImages.length >= layout.stages.length,
        `${where} has fewer process photos than stages`,
      );
      assert.equal(layout.overviewImage, layout.overviewImages[0], where);
      assert.equal(layout.processImage, layout.processImages[0], where);
      for (const src of [...layout.overviewImages, ...layout.processImages]) {
        assert.match(src, /^\/media\//u, where);
      }
    }
  }
});

test("the editorial bounds imagery and keeps complete copy visible", () => {
  // Every photo renders in a fixed ratio box so a portrait source cannot push a
  // section off-screen, and no rule may clip the clinic's copy.
  assert.match(component, /aspect-\[\d+\/\d+\]/u);
  assert.doesNotMatch(component, /line-clamp|truncate|text-overflow/u);
  assert.match(component, /layout\.fallback/u);
  assert.match(component, /introGroups/u);
  assert.match(component, /introNarrative/u);
  assert.match(component, /sensorChapters/u);
});

test("heading text resolves source escapes instead of showing them", () => {
  // Headings render as plain strings, not through Markdown. The published
  // Russian laser copy escapes the numeral's period, which would otherwise
  // print "1\. Консультация" on screen.
  assert.equal(sourceHeadingText("### 1\\. Consultation"), "1. Consultation");
  assert.equal(sourceHeadingText("- ### Foo \\* bar"), "Foo * bar");
  assert.equal(sourceHeadingText("### Step 1"), "Step 1");
  assert.equal(plainText("A **bold** and *light* word"), "A bold and light word");
  assert.equal(plainText("See [the guide](/x) now"), "See the guide now");
});
