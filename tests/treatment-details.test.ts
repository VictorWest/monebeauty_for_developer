import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  TREATMENT_SOURCE_VERSION,
  treatmentSourceIds,
} from "../content/treatment-provenance";
import {
  isSourceOwnedTreatmentDescription,
  isSourceOwnedTreatmentSummary,
} from "../content/treatment-sync-guard";
import {
  extractLegacy60TokenMarkdownSummary,
  extractLegacyMarkdownSummary,
  extractMarkdownSummary,
  normalizeRichTextMarkdown,
  removeRepeatedMarkdownSummary,
} from "../lib/markdown-normalization";

type Locale = "fi" | "en" | "ru";
type Treatment = {
  legacyIndex: number;
  group: string | null;
  name: string;
  durationLabel: string | null;
  priceLabel: string;
  summary: string;
  description: string;
  sourceUrl: string;
  scrapedAt: string;
  openingDescription: string;
  provenanceSourceIds: string[];
};
type Registry = {
  scrapedAt: string;
  services: Record<string, Record<string, Partial<Record<Locale, Treatment>>>>;
};

const registry = JSON.parse(
  readFileSync("content/generated/treatment-details.json", "utf8"),
) as Registry;
const provenance = JSON.parse(
  readFileSync("content/treatment-provenance.json", "utf8"),
) as { version: string; sources: Record<string, unknown> };
const summaryHistory = JSON.parse(
  readFileSync("content/treatment-summary-history.json", "utf8"),
) as {
  sourceCommit: string;
  summaries: Record<string, Record<string, Partial<Record<Locale, string>>>>;
};
const descriptionHistory = JSON.parse(
  readFileSync("content/treatment-description-history.json", "utf8"),
) as {
  sourceCommit: string;
  descriptions: Record<string, Record<string, Partial<Record<Locale, string>>>>;
};
const generator = readFileSync("scripts/gen-treatment-details.ts", "utf8");
const descriptionHistoryGenerator = readFileSync(
  "scripts/gen-treatment-description-history.mjs",
  "utf8",
);
const migration = readFileSync("scripts/migrate-treatment-options.ts", "utf8");
const sync = readFileSync("scripts/sync-cms-from-generated.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const liveContent = readFileSync("lib/live-content.ts", "utf8");
const route = readFileSync(
  "app/(public)/[locale]/palvelut/[slug]/[optionKey]/page.tsx",
  "utf8",
);
const detail = readFileSync(
  "components/services/TreatmentDetailPage.tsx",
  "utf8",
);
const cards = readFileSync(
  "components/services/ServiceCourseCards.tsx",
  "utf8",
);
const admin = readFileSync("components/admin/AdminRouter.tsx", "utf8");

const expected: Record<string, Record<Locale, number>> = {
  facial: { fi: 22, en: 22, ru: 22 },
  body: { fi: 7, en: 7, ru: 7 },
  trichology: { fi: 5, en: 5, ru: 5 },
  laser: { fi: 36, en: 36, ru: 36 },
  rf: { fi: 15, en: 15, ru: 14 },
  brows: { fi: 6, en: 6, ru: 6 },
  packages: { fi: 25, en: 24, ru: 25 },
  endospheres: { fi: 5, en: 5, ru: 5 },
};

function plain(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/[#*_`>\-–—•]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

test("the generated registry preserves the complete live localized inventory", () => {
  assert.equal(registry.scrapedAt, "2026-08-01");
  assert.deepEqual(
    Object.keys(registry.services).sort(),
    Object.keys(expected).sort(),
  );
  for (const [service, localeCounts] of Object.entries(expected)) {
    const options = registry.services[service];
    assert.ok(options, service);
    assert.equal(
      new Set(Object.keys(options)).size,
      Object.keys(options).length,
    );
    for (const locale of ["fi", "en", "ru"] as const) {
      const localized = Object.values(options).flatMap((entry) =>
        entry[locale] ? [entry[locale]!] : [],
      );
      assert.equal(
        localized.length,
        localeCounts[locale],
        `${service}/${locale}`,
      );
      if (service !== "packages")
        assert.equal(
          new Set(localized.map((item) => item.legacyIndex)).size,
          localized.length,
          `${service}/${locale} has a duplicate legacy index`,
        );
    }
  }
});

/**
 * The clinic rejected the generated copy that used to be appended to every
 * record ("the texts content are not from the previous website"), so the
 * contract is now the opposite of what it was: a description must be the
 * source text and nothing more.
 */
const GENERATED_COPY_PHRASES = [
  // English enrichment openers.
  /specific treatment option described in the source introduction/iu,
  /Suitability is assessed individually/iu,
  /The potential benefits are the treatment aims described in the source/iu,
  // Finnish.
  /yllä olevassa lähdetekstissä kuvattu yksittäinen hoitovaihtoehto/iu,
  /Sopivuus arvioidaan yksilöllisesti/iu,
  // Russian.
  /конкретный вариант процедуры, описанный/iu,
  /Подходящесть оценивается индивидуально/iu,
  // Retired procedure-editorial layer.
  /procedure-editorial-v1/u,
  /This explanation applies only/u,
  /Kortti kertoo yksittäisestä/u,
  /Описание относится только/u,
];

/** Section headings the retired enrichment injected, in all three locales. */
const GENERATED_SECTION_HEADINGS = [
  "What the treatment is and how it works",
  "Who it is suitable for",
  "Expected results and recommended treatment course",
  "Contraindications and safety",
  "Mikä hoito on ja miten se toimii",
  "Kenelle hoito sopii",
  "Odotettavat tulokset ja suositeltu hoitosarja",
  "Vasta-aiheet ja turvallisuus",
  "Что это за процедура и как она работает",
  "Кому подходит процедура",
  "Ожидаемые результаты и рекомендуемый курс",
  "Противопоказания и безопасность",
];

test("all 121 options and 361 localized records carry only sourced copy", () => {
  let optionCount = 0;
  let localizedCount = 0;
  assert.equal(provenance.version, TREATMENT_SOURCE_VERSION);

  for (const [service, options] of Object.entries(registry.services)) {
    optionCount += Object.keys(options).length;
    for (const [key, localized] of Object.entries(options)) {
      localizedCount += Object.keys(localized).length;
      for (const [locale, treatment] of Object.entries(localized) as Array<
        [Locale, Treatment]
      >) {
        const context = `${service}/${key}/${locale}`;
        assert.equal(
          treatment.description,
          treatment.openingDescription,
          `${context} description is not the verbatim source text`,
        );
        assert.deepEqual(
          treatment.provenanceSourceIds,
          treatmentSourceIds(service),
          context,
        );
        for (const sourceId of treatment.provenanceSourceIds)
          assert.ok(provenance.sources[sourceId], `${context}: ${sourceId}`);
        for (const phrase of GENERATED_COPY_PHRASES)
          assert.doesNotMatch(
            treatment.description,
            phrase,
            `${context} still contains generated copy`,
          );
        for (const heading of GENERATED_SECTION_HEADINGS)
          assert.ok(
            !treatment.description.includes(`## ${heading}`),
            `${context} still contains the generated section "${heading}"`,
          );
      }
    }
  }

  assert.equal(optionCount, 121);
  assert.equal(localizedCount, 361);
});

test("the retired copy generators are gone from the repository", () => {
  for (const path of [
    "content/treatment-enrichment.ts",
    "content/procedure-editorial.ts",
    "scripts/sync-procedure-descriptions.ts",
  ])
    assert.ok(!existsSync(path), `${path} should no longer exist`);

  const generator = readFileSync("scripts/gen-treatment-details.ts", "utf8");
  assert.doesNotMatch(generator, /buildTreatmentEnrichment|enrichRegistry/u);
  assert.match(generator, /attributeRegistry/u);
});

test("summaries and full descriptions are extractive, localized, and source attributed", () => {
  for (const [service, options] of Object.entries(registry.services)) {
    for (const [key, localized] of Object.entries(options)) {
      const descriptions: string[] = [];
      for (const [locale, treatment] of Object.entries(localized)) {
        if (!treatment) continue;
        const context = `${service}/${key}/${locale}`;
        assert.equal(
          treatment.summary,
          extractMarkdownSummary(treatment.openingDescription),
          `${context} summary is not a complete source block`,
        );
        assert.doesNotMatch(treatment.summary, /…\s*$/u, context);
        // Where the source published only an opening block, the summary is the
        // whole description: nothing was generated to pad it out.
        assert.ok(
          treatment.summary.length <= treatment.description.length,
          `${context} summary is longer than its description`,
        );
        assert.ok(
          plain(treatment.description).includes(plain(treatment.summary)),
          `${context} summary is not extractive`,
        );
        assert.doesNotMatch(
          removeRepeatedMarkdownSummary(
            treatment.description,
            treatment.summary,
          ),
          new RegExp(
            treatment.summary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
            "u",
          ),
          `${context} repeats its hero summary in the detail body`,
        );
        assert.match(
          treatment.sourceUrl,
          /^(?:https:\/\/monebeauty\.fi\/|Endospheres_Therapy_Website_Content_)/u,
        );
        assert.match(treatment.scrapedAt, /^2026-0[78]-\d{2}$/u);
        assert.doesNotMatch(
          `${treatment.summary} ${treatment.description}`,
          /&(?:#\d+|#x[\da-f]+|[a-z]{2,});/iu,
          `${context} contains an encoded entity`,
        );
        assert.doesNotMatch(
          treatment.description,
          /procedure-editorial-v1|This explanation applies only|Kortti kertoo yksittäisestä|Описание относится только/u,
          `${context} contains retired editorial boilerplate`,
        );
        descriptions.push(treatment.description);
      }
      assert.equal(
        new Set(descriptions).size,
        descriptions.length,
        `${service}/${key} reuses fallback copy across locales`,
      );
    }
  }
});

test("facial treatment 22 keeps structural headings below its hero in every locale", () => {
  const treatment = registry.services.facial["treatment-22"];
  const headings: Record<Locale, string> = {
    fi: "**Menettelyn edut:**",
    en: "**Advantages of the procedure:**",
    ru: "**Преимущества процедуры:**",
  };

  for (const locale of ["fi", "en", "ru"] as const) {
    const localized = treatment[locale]!;
    const body = removeRepeatedMarkdownSummary(
      localized.description,
      localized.summary,
    );
    assert.equal(body.split("\n")[0], headings[locale]);
    assert.equal(
      localized.description.split(localized.summary).length - 1,
      1,
      `${locale} repeats its hero summary in source Markdown`,
    );
    assert.doesNotMatch(
      localized.summary,
      /(?:Advantages|Menettelyn edut|Преимущества)/u,
    );
  }
});

test("the refresh generator is deterministic and rejects malformed source content", () => {
  assert.match(generator, /process\.argv\.includes\("--refresh"\)/);
  assert.match(generator, /process\.argv\.includes\("--check"\)/);
  assert.match(generator, /querySelectorAll\("\.services-section__row"\)/);
  assert.match(generator, /Undecoded HTML entity/);
  assert.match(generator, /Duplicate treatment key/);
  assert.match(generator, /Unmapped Packages source entries/);
  assert.match(generator, /Refusing unexpected response/);
});

test("detail content is database-owned and migration updates only guarded source fields", () => {
  for (const field of [
    /summary\s+String/,
    /description\s+String/,
    /sourceUrl\s+String\?/,
    /sourceScrapedAt\s+DateTime\?/,
  ])
    assert.match(schema, field);
  assert.match(migration, /if \(option\.archivedAt\)/);
  assert.match(migration, /current\.name === identity\.name/);
  assert.match(migration, /current\.group === identity\.group/);
  assert.match(migration, /samePublishedPrice\(current\.priceLabel/);
  assert.match(migration, /legacySourceIdentity/);
  assert.match(
    migration,
    /option\.legacyProcedureIndex === source\.legacyIndex/,
  );
  assert.match(migration, /isSourceOwnedTreatmentSummary/);
  assert.match(migration, /isSourceOwnedTreatmentDescription/);
  assert.match(migration, /treatment-description-history\.json/);
  assert.match(migration, /!current\.sourceUrl/);
  // Rows written by either retired generator are recognised as replaceable.
  assert.match(migration, /isRetiredGeneratedTreatmentCopy/);
  assert.match(sync, /SERVICE_OVERVIEWS/);
  assert.match(migration, /const sourceOwned/);
  assert.match(migration, /content\.whatItIs === importedAggregate/);
  assert.doesNotMatch(sync, /applyProcedureEditorial/);
});

test("description synchronization updates only empty and known source-owned copy", () => {
  const source = "Original localized source description";
  const enriched = `${source}\n\n## Benefits\n\nRecorded benefit.`;
  const historical = "Original localized source description • Legacy item";
  assert.equal(isSourceOwnedTreatmentDescription("", [source, enriched]), true);
  assert.equal(
    isSourceOwnedTreatmentDescription(source, [source, enriched]),
    true,
  );
  assert.equal(
    isSourceOwnedTreatmentDescription(
      historical,
      [source, enriched],
      [historical],
    ),
    true,
  );
  assert.equal(
    isSourceOwnedTreatmentDescription(
      ` ${historical}`,
      [source, enriched],
      [historical],
    ),
    false,
  );
  assert.equal(
    isSourceOwnedTreatmentDescription(enriched, [source, enriched]),
    true,
  );
  assert.equal(
    isSourceOwnedTreatmentDescription("Owner edited clinical copy", [
      source,
      enriched,
    ]),
    false,
  );
});

test("description history is the exact reproducible 953a40e source-owned delta", () => {
  assert.equal(descriptionHistory.sourceCommit, "953a40e");
  const entries = Object.entries(descriptionHistory.descriptions).flatMap(
    ([service, options]) =>
      Object.entries(options).flatMap(([key, localized]) =>
        Object.entries(localized).map(([locale, description]) => ({
          service,
          key,
          locale: locale as Locale,
          description: description!,
        })),
      ),
  );

  assert.equal(entries.length, 47);
  assert.deepEqual(
    entries.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.service] = (counts[entry.service] ?? 0) + 1;
      return counts;
    }, {}),
    { facial: 1, trichology: 12, packages: 34 },
  );
  assert.deepEqual(
    entries
      .filter((entry) => entry.service === "trichology")
      .map((entry) => `${entry.key}/${entry.locale}`)
      .sort(),
    ["02", "03", "04", "05"].flatMap((number) =>
      (["en", "fi", "ru"] as const).map(
        (locale) => `treatment-${number}/${locale}`,
      ),
    ),
  );
  assert.deepEqual(
    entries
      .filter((entry) => entry.service === "facial")
      .map((entry) => `${entry.key}/${entry.locale}`),
    ["treatment-12/fi"],
  );
  assert.ok(
    entries.some(
      (entry) =>
        entry.service === "packages" &&
        entry.key === "reset-course" &&
        entry.locale === "ru",
    ),
  );

  for (const entry of entries) {
    const opening =
      registry.services[entry.service][entry.key][entry.locale]
        ?.openingDescription;
    assert.ok(opening, `${entry.service}/${entry.key}/${entry.locale}`);
    assert.notEqual(entry.description, opening);
    assert.equal(normalizeRichTextMarkdown(entry.description), opening);
  }

  assert.match(descriptionHistoryGenerator, /SOURCE_COMMIT = "953a40e"/);
  assert.match(descriptionHistoryGenerator, /normalizeRichTextMarkdown/);
  assert.match(
    descriptionHistoryGenerator,
    /treatment-description-history\.json/,
  );
});

test("summary synchronization advances empty and exact source-owned versions only", () => {
  const source = `A complete localized opening paragraph with enough copy to demonstrate that the legacy generator used to shorten this source at a token boundary even though the clinic supplied a complete semantic block. This continuation makes the old extract exceed sixty tokens while the new summary remains the exact full paragraph without a generated ellipsis or any dropped sentence for display. Every final phrase is intentionally retained because source fidelity is the governing content requirement for all treatment cards.`;
  const current = extractMarkdownSummary(source);
  const legacy = extractLegacyMarkdownSummary(source);
  const legacySixty = extractLegacy60TokenMarkdownSummary(source);
  assert.equal(isSourceOwnedTreatmentSummary("", [source], current), true);
  assert.equal(isSourceOwnedTreatmentSummary(legacy, [source], current), true);
  assert.equal(
    isSourceOwnedTreatmentSummary(legacySixty, [source], current),
    true,
  );
  assert.equal(
    isSourceOwnedTreatmentSummary(
      legacy.replace(/\s+/gu, " "),
      [source],
      current,
    ),
    true,
  );
  assert.equal(isSourceOwnedTreatmentSummary(current, [source], current), true);
  assert.equal(
    isSourceOwnedTreatmentSummary(
      "Historical source-owned summary",
      [source],
      current,
      ["Historical source-owned summary"],
    ),
    true,
  );
  assert.equal(
    isSourceOwnedTreatmentSummary(
      " Historical source-owned summary ",
      [source],
      current,
      ["Historical source-owned summary"],
    ),
    false,
  );
  assert.equal(
    isSourceOwnedTreatmentSummary("Owner edited summary", [source], current),
    false,
  );
  assert.match(legacy, /…$/u);
  assert.doesNotMatch(current, /…$/u);
});

test("migration history contains only changed summaries from the source registry", () => {
  assert.equal(summaryHistory.sourceCommit, "953a40e");
  const entries = Object.values(summaryHistory.summaries).flatMap((options) =>
    Object.values(options).flatMap((localized) => Object.values(localized)),
  );
  assert.equal(entries.length, 285);
  for (const summary of entries) assert.ok(summary?.trim());
  assert.match(migration, /treatment-summary-history\.json/);
  assert.match(migration, /Array\.from\(localized\.values\(\)/);
  assert.doesNotMatch(migration, /localized\.values\(\)\.map/);
});

test("category cards lead to strict localized detail routes", () => {
  assert.match(
    cards,
    /treatmentOptionPath\([\s\S]*servicePath,[\s\S]*option\.key/,
  );
  assert.match(cards, /option\.summary/);
  assert.match(cards, /pathname: "\/ajanvaraus"/);
  assert.match(cards, /service: serviceKey/);
  assert.match(cards, /option: option\.key/);
  assert.match(liveContent, /description: \{ not: "" \}/);
  assert.match(liveContent, /archivedAt: null/);
  assert.match(liveContent, /published: true/);
  assert.match(route, /getPublishedServiceOption/);
  assert.match(route, /if \(!option\)[\s\S]*notFound\(\)/);
  assert.match(route, /redirect\(localizedPath\(servicePath, locale\)\)/);
});

test("treatment pages render source content, real media, booking and course behavior", () => {
  assert.equal((detail.match(/<h1/g) ?? []).length, 1);
  assert.match(detail, /resolveProcedureImage/);
  assert.match(
    detail,
    /<Markdown variant="treatment-detail">\{description\}<\/Markdown>/,
  );
  assert.match(detail, /option\.type === "COURSE"/);
  assert.match(detail, /removeRepeatedMarkdownSummary/);
  assert.match(
    detail,
    /query: \{[\s\S]*service: option\.service\.slug,[\s\S]*option: option\.key/,
  );
  assert.match(detail, /mailto:\$\{CONTACT\.email\}/);
  assert.match(detail, /serviceJsonLd/);
  assert.match(detail, /breadcrumbJsonLd/);
});

test("admin exposes the localized detail fields without a native date picker", () => {
  assert.match(admin, /optionSummary_/);
  assert.match(admin, /optionDescription_/);
  assert.match(admin, /optionSourceUrl_/);
  assert.match(admin, /optionSourceDate_/);
  assert.match(admin, /placeholder="YYYY-MM-DD"/);
  assert.doesNotMatch(admin, /type="date"/);
});
