import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  ENDOSPHERES_EDITORIAL,
  ENDOSPHERES_EDITORIAL_IMAGES,
} from "../content/endospheres";
import { SERVICE_OVERVIEWS } from "../content/service-overviews";
import { SERVICE_SUMMARIES } from "../content/service-summaries";

const locales = ["en", "fi", "ru"] as const;
const schema = readFileSync("prisma/schema.prisma", "utf8");
const courseMigration = readFileSync(
  "prisma/migrations/20260801220100_convert_bookable_service_courses/migration.sql",
  "utf8",
);
const optionMigration = readFileSync(
  "scripts/migrate-treatment-options.ts",
  "utf8",
);
const cards = readFileSync(
  "components/services/ServiceCourseCards.tsx",
  "utf8",
);
const servicePage = readFileSync(
  "components/services/ServiceDetailPage.tsx",
  "utf8",
);
const editorial = readFileSync(
  "components/endospheres/EndospheresEditorial.tsx",
  "utf8",
);
const bookingContext = readFileSync("lib/booking-context.ts", "utf8");
const bookingApi = readFileSync("app/api/booking/route.ts", "utf8");

test("every category has a distinct two-paragraph localized overview", () => {
  assert.deepEqual(Object.keys(SERVICE_OVERVIEWS).sort(), [
    "body",
    "brows",
    "consultation",
    "endospheres",
    "facial",
    "injectable",
    "laser",
    "packages",
    "rf",
    "trichology",
  ]);
  for (const [service, localized] of Object.entries(SERVICE_OVERVIEWS)) {
    const variants = locales.map((locale) => localized[locale]);
    assert.equal(
      new Set(variants).size,
      3,
      `${service} falls back across locales`,
    );
    for (const locale of locales) {
      const overview = localized[locale];
      assert.equal(
        overview.split(/\n\s*\n/u).length,
        2,
        `${service}/${locale} is not concise`,
      );
      assert.notEqual(overview, SERVICE_SUMMARIES[service]?.[locale]);
      assert.doesNotMatch(
        overview,
        /####|Into a basket|Lisää ostoskoriin|Добавить в корзину|procedure-editorial-v1/u,
      );
    }
  }
});

test("overview migration is guarded and idempotent by source ownership", () => {
  assert.match(optionMigration, /!content\.whatItIs\.trim\(\)/);
  assert.match(optionMigration, /content\.whatItIs === importedAggregate/);
  assert.match(optionMigration, /content\.whatItIs === authoredAggregate/);
  assert.match(optionMigration, /if \(!sourceOwned\)/);
  assert.match(optionMigration, /content\.whatItIs === overview/);
  assert.match(servicePage, /<Markdown>\{categoryOverview\}<\/Markdown>/);
  assert.doesNotMatch(servicePage, /<Markdown>\{summary\}<\/Markdown>/);
});

test("Endospheres editorial is localized, structured, and image-bounded", () => {
  for (const locale of locales) {
    assert.ok(ENDOSPHERES_EDITORIAL[locale].sections.length >= 4);
    assert.ok(ENDOSPHERES_EDITORIAL[locale].benefits.length >= 6);
  }
  assert.ok(ENDOSPHERES_EDITORIAL_IMAGES.length <= 3);
  for (const item of ENDOSPHERES_EDITORIAL_IMAGES) {
    assert.ok(existsSync(`public${item.src}`), item.src);
    for (const locale of locales) assert.ok(item.alt[locale].length > 12);
  }
  assert.match(editorial, /md:grid-cols-/);
  assert.match(editorial, /aspect-\[4\/3\]/);
  assert.match(editorial, /max-h-\[420px\]/);
  assert.doesNotMatch(editorial, /content\.whatItIs|<Markdown/);
});

test("course options remain server-owned and directly bookable", () => {
  assert.match(schema, /enum ServiceOptionType \{[\s\S]*COURSE/);
  assert.match(courseMigration, /parent\."slug" = 'endospheres'/);
  assert.match(courseMigration, /service\."slug" = 'packages'/);
  assert.match(courseMigration, /"bookingDurationMin"/);
  assert.match(courseMigration, /"bookingServiceId"/);
  assert.match(bookingContext, /BOOKABLE_OPTION_TYPES/);
  assert.match(bookingApi, /type: \{ in: \["APPOINTMENT", "COURSE"\] \}/);
  assert.match(cards, /pathname: "\/ajanvaraus"/);
  assert.match(cards, /service: serviceKey/);
  assert.match(cards, /option: option\.key/);
  assert.match(cards, /absolute inset-0/);
  assert.match(cards, /relative z-10/);
});

test("cards use equal rows, complete copy, aligned metadata, and subtle motion", () => {
  assert.match(cards, /auto-rows-fr/);
  assert.match(cards, /h-full/);
  assert.doesNotMatch(cards, /line-clamp-(?:2|6)/);
  assert.match(cards, /flex-nowrap/);
  assert.match(cards, /whitespace-nowrap/);
  assert.match(cards, /categoryPrice/);
  assert.match(cards, /hover:-translate-y-0\.5/);
  assert.match(cards, /motion-reduce:transform-none/);
  assert.match(cards, /focus-visible:outline-2/);
  assert.doesNotMatch(cards, /hover:border-accent/);
});
