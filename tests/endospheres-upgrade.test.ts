import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ENDOSPHERES_EDITORIAL,
  ENDOSPHERES_EN,
  ENDOSPHERES_PACKAGES,
  ENDOSPHERES_SERVICES,
  ENDOSPHERES_TRANSLATION_STATUS,
} from "../content/endospheres";

const options = readFileSync("content/treatment-option-migration.ts", "utf8");
const serviceDetail = readFileSync(
  "components/services/ServiceDetailPage.tsx",
  "utf8",
);
const technologyDetail = readFileSync(
  "components/technology/TechnologyDetailPage.tsx",
  "utf8",
);
const editorial = readFileSync(
  "components/endospheres/EndospheresEditorial.tsx",
  "utf8",
);
const bookingApi = readFileSync("app/api/booking/route.ts", "utf8");
const bookingContext = readFileSync("lib/booking-context.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260730170000_endospheres_booking_upgrade/migration.sql",
  "utf8",
);
const sync = readFileSync("scripts/sync-cms-from-generated.ts", "utf8");
const draftFi = readFileSync("content/drafts/endospheres.fi.md", "utf8");
const draftRu = readFileSync("content/drafts/endospheres.ru.md", "utf8");
const deployment = readFileSync(".github/workflows/deploy.yml", "utf8");
const treatmentRegistry = JSON.parse(
  readFileSync("content/generated/treatment-details.json", "utf8"),
) as {
  services: {
    packages: Record<
      string,
      Record<"en" | "fi" | "ru", { priceLabel: string }>
    >;
  };
};

test("approved English registry preserves every supplied section and benefit", () => {
  assert.deepEqual(
    ENDOSPHERES_EN.sections.map((section) => section.title),
    [
      "What is Endospheres Therapy®?",
      "The History of Endospheres Therapy®",
      "How Does It Work?",
      "Why Does Every Treatment Begin with the Lymphatic System?",
      "Clinical Evidence",
    ],
  );
  assert.equal(ENDOSPHERES_EN.benefits.length, 10);
  assert.match(ENDOSPHERES_EN.eyebrow, /Compressive Microvibration®/);
  assert.equal(ENDOSPHERES_EN.offer.price, "€99");
  assert.equal(ENDOSPHERES_EN.offer.regularPrice, "regular price €125");
});

test("single and package prices exactly match the client PDFs", () => {
  assert.deepEqual(
    ENDOSPHERES_SERVICES.map(
      ({ key, durationMin, price }) => [key, durationMin, price] as const,
    ),
    [
      ["endospheres-intro-75", 75, 99],
      ["endospheres-30", 30, 65],
      ["endospheres-45", 45, 85],
      ["endospheres-60", 60, 105],
      ["endospheres-75", 75, 125],
    ],
  );
  assert.deepEqual(ENDOSPHERES_PACKAGES, [
    { durationMin: 30, single: 65, six: 350, twelve: 650 },
    { durationMin: 45, single: 85, six: 450, twelve: 850 },
    { durationMin: 60, single: 105, six: 570, twelve: 1050 },
    { durationMin: 75, single: 125, six: 650, twelve: 1250 },
  ]);
  for (const item of ENDOSPHERES_PACKAGES) {
    for (const [sessions, expected] of [
      [6, item.six],
      [12, item.twelve],
    ] as const) {
      const option =
        treatmentRegistry.services.packages[
          `endospheres-${item.durationMin}-${sessions}`
        ];
      for (const locale of ["en", "fi", "ru"] as const)
        assert.equal(
          option[locale].priceLabel.replace(/[^\d]/gu, ""),
          String(expected),
        );
    }
  }
});

test("service editorial and technology route preserve approved English information", () => {
  assert.match(serviceDetail, /<EndospheresEditorial locale=\{locale\}/);
  assert.match(editorial, /ENDOSPHERES_EDITORIAL\[locale\]/);
  // The technology route keeps its database-owned legacy copy, but gives the
  // Endospheres record a dedicated lossless layout instead of one long stream.
  assert.match(technologyDetail, /technology\.slug === "endospheres"/u);
  assert.match(technologyDetail, /<TechnologyEditorial/u);
  assert.doesNotMatch(technologyDetail, /ENDOSPHERES_EN/u);
  assert.match(technologyDetail, /<Markdown variant="technology">/u);
  assert.equal(ENDOSPHERES_TRANSLATION_STATUS.status, "PENDING_CLINIC_SIGNOFF");
  assert.match(editorial, /aspect-\[4\/3\]/);
  assert.match(editorial, /max-h-\[420px\]/);
  for (const draft of [draftFi, draftRu]) {
    assert.match(draft, /status: PENDING_CLINIC_SIGNOFF/);
    assert.match(draft, /medical_review_required: true/);
    assert.match(draft, /Compressive Microvibration®/);
    assert.match(
      draft,
      /\|\s*75 (?:min|мин)\s*\|\s*125 €\s*\|\s*650 €\s*\|\s*1[  ]250 €\s*\|/,
    );
  }
  // The drafts stay the clinic's review document; the site reads the promoted
  // copy in content/endospheres.ts, never the Markdown.
  assert.doesNotMatch(sync, /content\/drafts/);
});

test("editorial column widths follow the content, not the row's turn", () => {
  // Alternating with `order` alone moved the content between two fixed tracks
  // and left the widths behind, so on every other row the heading took the wide
  // column and the paragraph was squeezed into a narrower measure than the rest
  // of the page. Both directions must now put the paragraphs in the wide track.
  assert.match(
    editorial,
    /md:grid-cols-\[minmax\(0,\.82fr\)_minmax\(0,1\.18fr\)\]/,
  );
  assert.match(
    editorial,
    /md:grid-cols-\[minmax\(0,1\.18fr\)_minmax\(0,\.82fr\)\]/,
  );

  // The heading is what moves to the second track, so when it is on the right
  // the second track must be the narrow one. Matched whitespace-insensitively
  // so reformatting cannot silently retire the assertion.
  assert.match(
    editorial.replace(/\s+/gu, " "),
    /headingOnRight \? "md:grid-cols-\[minmax\(0,1\.18fr\)_minmax\(0,\.82fr\)\]" : "md:grid-cols-\[minmax\(0,\.82fr\)_minmax\(0,1\.18fr\)\]"/,
    "the row with the heading on the right must narrow its second track",
  );

  // A tall image beside a single paragraph is centred rather than top-aligned.
  assert.match(editorial, /shortTextBesideImage/);
  assert.match(editorial, /section\.paragraphs\.length === 1/);
  assert.match(editorial, /md:items-center/);
});

test("Finnish and Russian carry the same approved information as English", () => {
  // Both locales used to show a shorter locally-written summary, so a Finnish
  // or Russian visitor saw materially less than an English one.
  for (const locale of ["fi", "ru"] as const) {
    const localized = ENDOSPHERES_EDITORIAL[locale];
    assert.equal(
      localized.sections.length,
      ENDOSPHERES_EN.sections.length,
      `${locale} is missing sections from the approved PDF`,
    );
    assert.equal(
      localized.sections.flatMap((section) => section.paragraphs).length,
      ENDOSPHERES_EN.sections.flatMap((section) => section.paragraphs).length,
      `${locale} is missing paragraphs from the approved PDF`,
    );
    assert.equal(
      localized.benefits.length,
      ENDOSPHERES_EN.benefits.length,
      `${locale} is missing benefits from the approved PDF`,
    );
    for (const section of localized.sections) {
      assert.ok(section.title.trim(), locale);
      for (const paragraph of section.paragraphs)
        assert.ok(paragraph.trim().length > 80, `${locale}: ${paragraph}`);
    }
    // Translated prose, not the English left in place.
    assert.doesNotMatch(
      localized.sections[0].paragraphs[0],
      /is an innovative Italian technology/u,
    );
    if (locale === "ru")
      assert.match(localized.sections[0].paragraphs[0], /[Ѐ-ӿ]/u);
  }
});

test("durations, offer, and package prices migrate to normalized options", () => {
  assert.match(options, /ENDOSPHERES_SERVICES/);
  assert.match(options, /ENDOSPHERES_PACKAGES/);
  assert.match(options, /type: "COURSE"/);
  assert.match(options, /bookingServiceSlug: `endospheres-/);
  assert.match(options, /offerRequiresAccount: item\.offer/);
});

test("booking supports fixed prices, a family, and an account-only offer", () => {
  assert.match(schema, /priceMode\s+ServicePriceMode/);
  assert.match(schema, /bookingFamily\s+String\?/);
  assert.match(schema, /bookingPickerVisible\s+Boolean/);
  assert.match(schema, /offerRequiresAccount\s+Boolean/);
  assert.match(bookingContext, /bookingPickerVisible: true/);
  assert.match(bookingContext, /priceMode: service\.priceMode/);
  assert.match(bookingApi, /offer_account_required/);
  assert.match(bookingApi, /offer_not_eligible/);
  assert.match(bookingApi, /status: \{ not: "CANCELLED" \}/);
  assert.match(bookingApi, /bookingFamily: ENDOSPHERES_BOOKING_FAMILY/);
});

test("migration copies resources and adds the complete global price list", () => {
  assert.match(migration, /INSERT INTO "_RoomToService"/);
  assert.match(migration, /INSERT INTO "_DeviceToService"/);
  assert.match(migration, /INSERT INTO "PractitionerServiceCapability"/);
  assert.match(migration, /INSERT INTO "PractitionerServiceCapabilityDevice"/);
  for (const amount of [
    99, 65, 85, 105, 125, 350, 650, 450, 850, 570, 1050, 1250,
  ]) {
    assert.match(migration, new RegExp(`\\b${amount}(?:::numeric)?\\b`));
  }
});

test("production deployment applies generated content and guarded treatment synchronization", () => {
  assert.match(deployment, /npx prisma migrate deploy/);
  assert.match(deployment, /npm run db:sync-content/);
  assert.match(deployment, /npm run db:migrate-treatment-options:apply/);
  assert.ok(
    deployment.indexOf("npm run db:sync-content") <
      deployment.indexOf("npm run db:migrate-treatment-options:apply"),
  );
});
