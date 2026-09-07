import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ENDOSPHERES_OPTION_SEED,
  PACKAGES_OPTION_SEED,
  STANDALONE_APPOINTMENT_OPTION_SEED,
  maximumPublishedDuration,
  packagesLegacyOptionKey,
} from "../content/treatment-option-migration";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const booking = readFileSync("lib/booking.ts", "utf8");
const api = readFileSync("app/api/booking/route.ts", "utf8");
const context = readFileSync("lib/booking-context.ts", "utf8");
const migration = readFileSync("scripts/migrate-treatment-options.ts", "utf8");
const standaloneMigration = readFileSync(
  "prisma/migrations/20260801233000_bookable_authored_services/migration.sql",
  "utf8",
);

test("duration ranges reserve their maximum published time", () => {
  assert.equal(maximumPublishedDuration("60–80 minutes"), 80);
  assert.equal(maximumPublishedDuration("45-60 min"), 60);
  assert.equal(maximumPublishedDuration("75 мин"), 75);
  assert.equal(maximumPublishedDuration("price on request"), null);
});

test("normalized options and immutable appointment snapshots are persisted", () => {
  assert.match(schema, /model ServiceOption \{/);
  assert.match(schema, /model ServiceOptionContent \{/);
  assert.match(schema, /type\s+ServiceOptionType/);
  assert.match(schema, /serviceOptionId\s+String\?/);
  assert.match(schema, /bookingServiceId\s+String\?/);
  assert.match(schema, /bookingDurationMin\s+Int\?/);
  assert.match(schema, /@@unique\(\[serviceId, key\]\)/);
});

test("public scheduling resolves option duration on the server", () => {
  assert.match(booking, /record\.option\?\.bookingDurationMin/);
  assert.match(booking, /option\?\.bookingService \?\? service/);
  assert.match(api, /type: \{ in: \["APPOINTMENT", "COURSE"\] \}/);
  assert.match(api, /serviceOptionId: option\.id/);
  assert.match(api, /bookingDurationMin: option\.bookingDurationMin/);
  assert.doesNotMatch(api, /payload\.durationMin/);
});

test("authored consultation and injectable services are directly bookable", () => {
  assert.deepEqual(
    STANDALONE_APPOINTMENT_OPTION_SEED.map((item) => [
      item.serviceSlug,
      item.key,
      item.bookingDurationMin,
    ]),
    [
      ["consultation", "consultation-30", 30],
      ["injectable", "injectable-45", 45],
    ],
  );
  assert.ok(
    STANDALONE_APPOINTMENT_OPTION_SEED.every((item) =>
      (["en", "fi", "ru"] as const).every(
        (locale) => item.groups[locale] && item.durationLabels[locale],
      ),
    ),
  );
  assert.match(standaloneMigration, /'consultation-30'/);
  assert.match(standaloneMigration, /'injectable-45'/);
  assert.match(standaloneMigration, /NULL,\s+content\."status"/);
  assert.match(standaloneMigration, /ON CONFLICT DO NOTHING/);
});

test("legacy indices map through persisted option identity", () => {
  assert.match(context, /legacyProcedureIndex === legacyIndex/);
  assert.match(context, /optionKey/);
  assert.match(context, /packagesLegacyOptionKey\(locale, legacyIndex\)/);
  assert.match(
    migration,
    /legacyProcedureIndex:[\s\S]*firstLegacyIndex\(detail\)/,
  );
});

test("Endospheres offer and all eight first-visit courses are bookable", () => {
  const offer = ENDOSPHERES_OPTION_SEED.find((item) => item.key === "intro-75");
  assert.equal(offer?.offerRequiresAccount, true);
  const packages = ENDOSPHERES_OPTION_SEED.filter(
    (item) => item.type === "COURSE",
  );
  assert.equal(packages.length, 8);
  assert.ok(
    packages.every(
      (item) =>
        item.bookable &&
        [30, 45, 60, 75].includes(item.bookingDurationMin) &&
        item.bookingServiceSlug === `endospheres-${item.bookingDurationMin}`,
    ),
  );
});

test("Packages uses semantic localized first-visit course options", () => {
  assert.equal(PACKAGES_OPTION_SEED.length, 25);
  assert.equal(new Set(PACKAGES_OPTION_SEED.map((item) => item.key)).size, 25);
  assert.equal(
    PACKAGES_OPTION_SEED.filter((item) => item.labels.en).length,
    24,
  );
  assert.equal(
    PACKAGES_OPTION_SEED.filter((item) => item.labels.fi).length,
    25,
  );
  assert.equal(
    PACKAGES_OPTION_SEED.filter((item) => item.labels.ru).length,
    25,
  );
  const faceCare = PACKAGES_OPTION_SEED.find(
    (item) => item.key === "endospheres-face-care-6",
  );
  assert.deepEqual(Object.keys(faceCare?.labels ?? {}), ["fi", "ru"]);
  assert.equal(
    PACKAGES_OPTION_SEED.find((item) => item.key === "reset-course")
      ?.bookingDurationMin,
    90,
  );
  assert.equal(
    PACKAGES_OPTION_SEED.find((item) => item.key === "endospheres-45-12")
      ?.bookingDurationMin,
    45,
  );
  assert.equal(
    PACKAGES_OPTION_SEED.find((item) => item.key === "endospheres-45-12")
      ?.bookingServiceSlug,
    "endospheres-45",
  );
  assert.equal(
    PACKAGES_OPTION_SEED.find((item) => item.key === "arosha-wrap-12")
      ?.bookingDurationMin,
    60,
  );
  assert.equal(
    PACKAGES_OPTION_SEED.find((item) => item.key === "fractional-mesotherapy-5")
      ?.bookingDurationMin,
    60,
  );
  assert.ok(
    PACKAGES_OPTION_SEED.filter((item) => item.key.startsWith("laser-")).every(
      (item) =>
        item.bookingDurationMin === 60 && item.bookingServiceSlug === "laser",
    ),
  );
  for (const locale of ["en", "fi", "ru"] as const) {
    const localized = PACKAGES_OPTION_SEED.filter(
      (item) => item.labels[locale],
    ).sort((left, right) => left.displayOrder - right.displayOrder);
    assert.ok(
      localized.every((item) => {
        const content = item.labels[locale];
        return Boolean(
          content?.group &&
          content.name &&
          content.durationLabel &&
          content.priceLabel,
        );
      }),
    );
    assert.equal(localized[0].key, "reset-course");
    assert.equal(localized.at(-1)?.key, "laser-full-body-10");
    assert.equal(
      localized.findIndex((item) => item.key === "fractional-mesotherapy-5"),
      locale === "en" ? 11 : 12,
    );
  }
  const endospheresTwelve = PACKAGES_OPTION_SEED.find(
    (item) => item.key === "endospheres-60-12",
  );
  assert.equal(endospheresTwelve?.labels.en?.priceLabel, "€1050");
  assert.equal(endospheresTwelve?.labels.fi?.priceLabel, "1050 €");
  assert.equal(endospheresTwelve?.labels.ru?.priceLabel, "1050 €");
});

test("Packages preserves locale-aware legacy procedure links", () => {
  assert.equal(packagesLegacyOptionKey("fi", 2), "arosha-wrap-6");
  assert.equal(packagesLegacyOptionKey("en", 2), "endospheres-30-6");
  assert.equal(packagesLegacyOptionKey("ru", 12), "endospheres-face-care-6");
  assert.equal(packagesLegacyOptionKey("fi", 17), null);
});

test("migration defaults to dry-run and guards canonical creation and archival", () => {
  assert.match(migration, /process\.argv\.includes\("--apply"\)/);
  assert.match(migration, /admin-edited content are never overwritten/);
  assert.match(migration, /PACKAGES_OPTION_SEED/);
  assert.match(
    migration,
    /record differs from the superseded generated source/,
  );
  assert.match(migration, /updateMany/);
  assert.match(migration, /updatedAt: option\.updatedAt/);
  assert.match(migration, /matchesCanonicalPackageOption/);
  assert.match(migration, /type: "COURSE"/);
  assert.match(migration, /bookingServiceId/);
  assert.doesNotMatch(migration, /serviceOption\.update\(/);
});
