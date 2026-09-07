import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pagesData from "../content/generated/pages.json";
import registryData from "../content/generated/treatment-details.json";
import {
  parseProcedures,
  replaceProcedureDescriptions,
} from "../lib/procedures";
import { isRetiredGeneratedTreatmentCopy } from "../content/treatment-sync-guard";
import type { Locale } from "../i18n/routing";

/**
 * Replaces `tests/procedure-editorial.test.ts`.
 *
 * That suite asserted every procedure card carried *generated* copy: unique
 * paraphrases of 70–120 words, each stamped with an idempotency marker. The
 * clinic rejected exactly that ("the texts content are not from the previous
 * website"), so the contract is inverted here — a card must carry the source's
 * own words, unchanged.
 */
const pages = pagesData as Record<string, Record<Locale, { body: string }>>;
const registry = registryData as unknown as {
  services: Record<
    string,
    Record<
      string,
      Partial<
        Record<Locale, { name: string; description: string; summary: string }>
      >
    >
  >;
};
const services = {
  facial: "services/face",
  body: "services/body",
  laser: "services/laser",
  rf: "services/mikroneulanrf",
  trichology: "services/tricho",
  brows: "services/eyebrows",
  packages: "services/packages",
} as const;
const locales: Locale[] = ["en", "fi", "ru"];

function plain(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/[#*_`>\-–—•]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Compares wording while ignoring whitespace, so that emphasis boundaries in
 * the Markdown archive (`**12**0 €`) do not read as a difference in copy
 * against the same sentence parsed out of the raw HTML.
 */
function tight(value: string) {
  return plain(value).replace(/\s+/gu, "");
}

test("nested content headings remain inside their procedure card", () => {
  const markdown = `### Peels
#### Example peel
An opening explanation.

#### Benefits
- One approved benefit

### Results
The published result text.

#### 120 € / 60 min`;
  const procedures = parseProcedures(markdown);
  assert.equal(procedures.length, 1);
  assert.equal(procedures[0].title, "Example peel");
  assert.match(procedures[0].description, /#### Benefits/);
  assert.match(procedures[0].description, /### Results/);
});

test("description replacement preserves identity, price and one-based order", () => {
  const source = pages[services.body].en.body;
  const before = parseProcedures(source);
  const updated = replaceProcedureDescriptions(
    source,
    new Map([[0, "A complete replacement for the first card."]]),
  );
  const after = parseProcedures(updated);
  assert.equal(after.length, before.length);
  assert.deepEqual(
    after.map(({ group, title, price }) => ({ group, title, price })),
    before.map(({ group, title, price }) => ({ group, title, price })),
  );
  assert.equal(
    after[0].description,
    "A complete replacement for the first card.",
  );
  assert.equal(after[1].description, before[1].description);
});

test("every generated procedure description is the source text verbatim", () => {
  let checked = 0;
  for (const [serviceSlug, pageSlug] of Object.entries(services)) {
    for (const locale of locales) {
      const sourceDescriptions = new Set(
        parseProcedures(pages[pageSlug][locale].body).map((procedure) =>
          tight(procedure.description),
        ),
      );
      for (const [key, localized] of Object.entries(
        registry.services[serviceSlug],
      )) {
        const treatment = localized[locale];
        if (!treatment) continue;
        const context = `${serviceSlug}/${key}/${locale}`;
        const description = tight(treatment.description);
        // Packages are re-keyed by duration and session count, so their card
        // text is assembled from the same source blocks under a new key.
        if (serviceSlug === "packages") {
          assert.ok(description.length > 0, context);
          continue;
        }
        assert.ok(
          sourceDescriptions.has(description),
          `${context} does not match any description published on ${pageSlug}`,
        );
        checked += 1;
      }
    }
  }
  assert.ok(checked > 250, `only ${checked} descriptions were verified`);
});

test("no procedure carries copy from the retired generators", () => {
  for (const [serviceSlug, options] of Object.entries(registry.services))
    for (const [key, localized] of Object.entries(options))
      for (const [locale, treatment] of Object.entries(localized)) {
        if (!treatment) continue;
        const context = `${serviceSlug}/${key}/${locale}`;
        assert.doesNotMatch(
          treatment.description,
          /procedure-editorial/u,
          context,
        );
        assert.doesNotMatch(
          treatment.description,
          /This explanation applies only|Kortti kertoo yksittäisestä|Описание относится только/u,
          context,
        );
      }
});

test("the summary is a contiguous quote of the description", () => {
  for (const [serviceSlug, options] of Object.entries(registry.services))
    for (const [key, localized] of Object.entries(options))
      for (const [locale, treatment] of Object.entries(localized)) {
        if (!treatment) continue;
        assert.ok(
          plain(treatment.description).includes(plain(treatment.summary)),
          `${serviceSlug}/${key}/${locale} summary is not quoted from its description`,
        );
      }
});

test("copy left behind by the retired generators is replaceable", () => {
  // Rows written by the enrichment carry no marker, so without this they match
  // neither the new source text nor any recorded history, are read as
  // clinic-edited, and keep their boilerplate through every future sync.
  assert.equal(
    isRetiredGeneratedTreatmentCopy(
      "Procedure for one area\n\n## What the treatment is and how it works\n\nx\n\n## Who it is suitable for\n\ny",
    ),
    true,
  );
  assert.equal(
    isRetiredGeneratedTreatmentCopy(
      "Hoito yhdelle alueelle\n\n## Mikä hoito on ja miten se toimii\n\nx\n\n## Vasta-aiheet ja turvallisuus\n\ny",
    ),
    true,
  );
  assert.equal(
    isRetiredGeneratedTreatmentCopy("[procedure-editorial-v1]: #\n\nText."),
    true,
  );
  // Genuine clinic copy is never mistaken for it: one shared heading is not
  // enough, and the source's own section names are left alone.
  assert.equal(
    isRetiredGeneratedTreatmentCopy(
      "A treatment.\n\n## Benefits\n\n- one\n\n## Preparation\n\nx",
    ),
    false,
  );
  assert.equal(
    isRetiredGeneratedTreatmentCopy(
      "A treatment.\n\n## Contraindications and safety\n\nx",
    ),
    false,
  );
  assert.equal(isRetiredGeneratedTreatmentCopy(""), false);
  assert.equal(isRetiredGeneratedTreatmentCopy(null), false);

  // No generated record trips the detector, so a re-sync cannot loop.
  for (const options of Object.values(registry.services))
    for (const [key, localized] of Object.entries(options))
      for (const [locale, treatment] of Object.entries(localized))
        if (treatment)
          assert.equal(
            isRetiredGeneratedTreatmentCopy(treatment.description),
            false,
            `${key}/${locale}`,
          );
});

test("the retired editorial generator is no longer wired into the sync scripts", () => {
  const migration = readFileSync(
    "scripts/migrate-treatment-options.ts",
    "utf8",
  );
  assert.doesNotMatch(migration, /applyProcedureEditorial/u);
  assert.doesNotMatch(migration, /procedure-editorial/u);
  const detail = readFileSync(
    "components/services/ServiceDetailPage.tsx",
    "utf8",
  );
  assert.doesNotMatch(detail, /procedure-editorial-v1/u);
});
