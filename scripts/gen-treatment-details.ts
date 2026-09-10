import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "node-html-parser";
import TurndownService from "turndown";
import { PACKAGES_OPTION_SEED } from "../content/treatment-option-migration";
import { ENDOSPHERES_EN, ENDOSPHERES_SERVICES } from "../content/endospheres";
import {
  TREATMENT_SOURCE_VERSION,
  treatmentSourceIds,
} from "../content/treatment-provenance";
import {
  extractMarkdownSummary,
  malformedRichTextPattern,
  normalizeRichTextMarkdown,
} from "../lib/markdown-normalization";

const ROOT = resolve(import.meta.dirname, "..");
const INPUT = process.env.TREATMENT_SCRAPE_DIR
  ? resolve(process.env.TREATMENT_SCRAPE_DIR)
  : join(ROOT, "scraped_content", "_raw");
const OUTPUT = join(ROOT, "content", "generated", "treatment-details.json");
const PROVENANCE = JSON.parse(
  readFileSync(join(ROOT, "content", "treatment-provenance.json"), "utf8"),
) as { version: string; sources: Record<string, unknown> };
const locales = ["fi", "en", "ru"] as const;

/** The date already recorded in the committed registry, if there is one. */
function committedScrapeDate() {
  if (!existsSync(OUTPUT)) return null;
  const scrapedAt = (
    JSON.parse(readFileSync(OUTPUT, "utf8")) as { scrapedAt?: string }
  ).scrapedAt;
  return typeof scrapedAt === "string" && scrapedAt ? scrapedAt : null;
}

/**
 * When the archive was captured: not when the generator happens to run.
 *
 * Defaulting to today made the registry stale the day after it was written, so
 * `--check` failed on every later day even with nothing changed. `--refresh`
 * re-downloads the archive, so only that path dates the output to now.
 */
const SCRAPED_AT =
  process.env.TREATMENT_SCRAPED_AT ||
  (process.argv.includes("--refresh") ? null : committedScrapeDate()) ||
  new Date().toISOString().slice(0, 10);
const services = [
  ["facial", "face"],
  ["body", "body"],
  ["trichology", "tricho"],
  ["laser", "laser"],
  ["rf", "mikroneulanrf"],
  ["brows", "eyebrows"],
  ["packages", "packages"],
] as const;

type Locale = (typeof locales)[number];
type SourceTreatment = {
  legacyIndex: number;
  group: string | null;
  name: string;
  durationLabel: string | null;
  priceLabel: string;
  summary: string;
  description: string;
  sourceUrl?: string;
  scrapedAt?: string;
};

type LocalizedTreatment = SourceTreatment & {
  sourceUrl: string;
  scrapedAt: string;
  /**
   * Retained as the canonical source text. It is now identical to
   * `description`; before the templated enrichment was removed the two
   * differed, and downstream sync guards still compare against it.
   */
  openingDescription: string;
  provenanceSourceIds: string[];
};

const endospheresPdf =
  "Endospheres_Therapy_Website_Content_Mone_Beauty_Clinic.pdf";
const refresh = process.argv.includes("--refresh");
const check = process.argv.includes("--check");
const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

async function main() {
  if (refresh) await refreshInputs();

  const registry: Record<
    string,
    Record<string, Partial<Record<Locale, LocalizedTreatment>>>
  > = {};

  for (const [serviceSlug, liveSlug] of services) {
    registry[serviceSlug] = {};
    for (const locale of locales) {
      const html = readFileSync(resolveInput(locale, liveSlug), "utf8");
      const sourceUrl = liveUrl(locale, liveSlug);
      const treatments = extractTreatments(html, `${serviceSlug}/${locale}`);
      const keyedTreatments =
        serviceSlug === "packages"
          ? packageTreatments(locale, treatments)
          : treatments.map((treatment) => ({
              key: `treatment-${String(treatment.legacyIndex).padStart(2, "0")}`,
              treatment,
            }));
      for (const { key, treatment } of keyedTreatments) {
        if (registry[serviceSlug][key]?.[locale]) {
          throw new Error(
            `Duplicate treatment key ${serviceSlug}/${key}/${locale}`,
          );
        }
        (registry[serviceSlug][key] ??= {})[locale] = {
          ...treatment,
          sourceUrl: treatment.sourceUrl ?? sourceUrl,
          scrapedAt: treatment.scrapedAt ?? SCRAPED_AT,
        } as LocalizedTreatment;
      }
    }
  }

  addApprovedEndospheres(registry);
  normalizeRegistryMarkdown(registry);
  attributeRegistry(registry);
  validateRegistry(registry);
  const output = `${JSON.stringify({ scrapedAt: SCRAPED_AT, services: registry }, null, 2)}\n`;

  if (check) {
    if (!existsSync(OUTPUT) || readFileSync(OUTPUT, "utf8") !== output) {
      throw new Error(
        "Treatment detail registry is stale. Run npm run content:gen-treatment-details.",
      );
    }
    console.log(`Verified ${OUTPUT}`);
  } else {
    writeFileSync(OUTPUT, output);
    console.log(`Wrote ${OUTPUT}`);
  }
  for (const [service, options] of Object.entries(registry)) {
    const localized = Object.values(options).reduce(
      (count, entry) => count + Object.keys(entry).length,
      0,
    );
    console.log(
      `${service}: ${Object.keys(options).length} stable options, ${localized} localized descriptions`,
    );
  }
}

async function refreshInputs() {
  mkdirSync(INPUT, { recursive: true });
  for (const [, liveSlug] of services) {
    for (const locale of locales) {
      const url = liveUrl(locale, liveSlug);
      const response = await fetch(url, {
        headers: { "user-agent": "MoneBeautyContentRefresh/1.0" },
      });
      if (!response.ok)
        throw new Error(`Could not refresh ${url}: HTTP ${response.status}`);
      const html = await response.text();
      if (!html.includes("services-section__row"))
        throw new Error(`Refusing unexpected response for ${url}`);
      writeFileSync(join(INPUT, `${locale}-${liveSlug}.html`), html);
      console.log(`Refreshed ${url}`);
    }
  }
}

function liveUrl(locale: Locale, liveSlug: string) {
  return `https://monebeauty.fi/${locale === "fi" ? "" : `${locale.toUpperCase()}/`}services/${liveSlug}/`;
}

function addApprovedEndospheres(
  registry: Record<
    string,
    Record<string, Partial<Record<Locale, LocalizedTreatment>>>
  >,
) {
  const approvedBody = ENDOSPHERES_EN.sections
    .map(
      (section) => `## ${section.title}\n\n${section.paragraphs.join("\n\n")}`,
    )
    .join("\n\n");
  const bodyDurationKey = new Map([
    [30, "treatment-01"],
    [45, "treatment-03"],
    [60, "treatment-04"],
    [75, "treatment-05"],
  ]);
  registry.endospheres = Object.fromEntries(
    ENDOSPHERES_SERVICES.map((service, index) => {
      const duration = ENDOSPHERES_EN.durations.find(
        (item) => item.durationMin === service.durationMin,
      );
      const durationTitle =
        duration && "title" in duration
          ? duration.title
          : `${service.durationMin} min`;
      const description =
        `${approvedBody}\n\n## Which Treatment Duration Should I Choose?\n\n### ${durationTitle}\n\n${duration?.text ?? ""}`.trim();
      const localized = Object.fromEntries(
        locales.map((locale) => {
          if (locale === "en")
            return [
              locale,
              {
                legacyIndex: index + 1,
                group: ENDOSPHERES_EN.eyebrow,
                name: service.labels.en,
                durationLabel: `${service.durationMin} min`,
                priceLabel: `€${service.price}`,
                summary: extractSummary(description),
                description,
                sourceUrl: endospheresPdf,
                scrapedAt: "2026-07-30",
              },
            ];
          const source =
            registry.body[bodyDurationKey.get(service.durationMin)!]?.[locale];
          if (!source)
            throw new Error(
              `Missing ${locale} Endospheres ${service.durationMin}-minute source`,
            );
          return [
            locale,
            {
              ...source,
              legacyIndex: index + 1,
              name: service.labels[locale],
              durationLabel:
                locale === "ru"
                  ? `${service.durationMin} мин`
                  : `${service.durationMin} min`,
              priceLabel: `${service.price} €`,
            },
          ];
        }),
      );
      return [service.key, localized];
    }),
  );
}

function resolveInput(locale: Locale, liveSlug: string) {
  const candidates = [
    join(INPUT, `${locale}-${liveSlug}.html`),
    join(INPUT, locale, `services-${liveSlug}.html`),
    join(INPUT, locale, `services_${liveSlug}.html`),
  ];
  const found = candidates.find((candidate) => {
    try {
      readFileSync(candidate);
      return true;
    } catch {
      return false;
    }
  });
  if (!found)
    throw new Error(`Missing raw service page; tried ${candidates.join(", ")}`);
  return found;
}

function extractTreatments(html: string, context: string): SourceTreatment[] {
  const root = parse(html);
  const rows = root.querySelectorAll(".services-section__row");
  return rows.map((row, index) => {
    const article = row.querySelector("article.services-item");
    const h3 = text(
      article?.querySelector("h3.services-item__title")?.textContent ?? "",
    );
    const headings =
      article
        ?.querySelectorAll("h4.services-item__title")
        .map((item) => text(item.textContent)) ?? [];
    // The legacy page renders a product/variant label in h3 and the bookable
    // treatment identity in the first h4. Preserve that established mapping so
    // existing ServiceOption keys continue to resolve the same treatment.
    const name =
      headings[0] || h3 || text(row.getAttribute("data-group") ?? "");
    const group = h3 || null;
    const descriptionElement = article?.querySelector(".services-item__text");
    const description = descriptionElement
      ? htmlToMarkdown(descriptionElement.innerHTML)
      : "";
    if (!name || !headings.at(-1) || !description)
      throw new Error(
        `Could not parse ${context} service row ${index + 1}: headings=${JSON.stringify(headings)}, description=${description.length}`,
      );
    const priceLabel = headings.at(-1)!;
    return {
      legacyIndex: index + 1,
      group,
      name,
      durationLabel:
        text(row.getAttribute("data-time") ?? "") || durationPart(priceLabel),
      priceLabel,
      summary: extractSummary(description),
      description,
    };
  });
}

function packageTreatments(locale: Locale, treatments: SourceTreatment[]) {
  const used = new Set<number>();
  const keyed = PACKAGES_OPTION_SEED.flatMap((seed) => {
    const label = seed.labels[locale];
    if (!label) return [];
    const candidates = treatments.filter((candidate) =>
      packageTreatmentMatches(label, candidate),
    );
    const treatment =
      candidates.find((candidate) => exactPackageIdentity(label, candidate)) ??
      candidates.find((candidate) => !used.has(candidate.legacyIndex)) ??
      candidates[0];
    if (!treatment)
      throw new Error(`No source Packages entry for ${locale}/${seed.key}`);
    used.add(treatment.legacyIndex);
    return [
      {
        key: seed.key,
        treatment: approvedPackageTreatment(locale, seed.key, label, treatment),
      },
    ];
  });
  const unused = treatments.filter(
    (treatment) => !used.has(treatment.legacyIndex),
  );
  if (unused.length)
    throw new Error(
      `Unmapped Packages source entries for ${locale}: ${unused.map((item) => `#${item.legacyIndex} ${item.group} / ${item.name}`).join(", ")}`,
    );
  return keyed;
}

function exactPackageIdentity(
  label: { group: string; name: string },
  treatment: SourceTreatment,
) {
  const group = normalize(label.group);
  const name = normalize(label.name);
  const treatmentGroup = normalize(treatment.group || "");
  const treatmentName = normalize(treatment.name);
  return (
    (group === treatmentGroup && name === treatmentName) ||
    (group === treatmentName && name === treatmentGroup)
  );
}

function packageTreatmentMatches(
  label: { group: string; name: string; priceLabel: string },
  treatment: SourceTreatment,
) {
  const group = normalize(label.group);
  const name = normalize(label.name);
  const treatmentGroup = normalize(treatment.group || "");
  const treatmentName = normalize(treatment.name);
  const exactIdentity =
    (group === treatmentName && name === treatmentGroup) ||
    (group === treatmentGroup && name === treatmentName) ||
    name === treatmentName;
  if (exactIdentity)
    return /endospheres/iu.test(`${group} ${treatmentGroup}`)
      ? true
      : samePrice(label.priceLabel, treatment.priceLabel);
  const seedDuration = name.match(/(?:^|\s)(30|45|60|75)(?:\s|$)/u)?.[1];
  const seedSessions = name.match(/(?:^|\s)(6|12)(?:\s|$)/u)?.[1];
  const treatmentSessions = treatmentName.match(/(?:^|\s)(6|12)(?:\s|$)/u)?.[1];
  const aggregateEndospheres =
    group === treatmentGroup &&
    seedDuration &&
    treatmentName.includes(seedDuration) &&
    (!treatmentSessions || !seedSessions || seedSessions === treatmentSessions);
  const aggregateArosha = group === treatmentName && /arosha/iu.test(group);
  const approvedEndospheresPrice = Boolean(aggregateEndospheres);
  return Boolean(
    (approvedEndospheresPrice || aggregateArosha) &&
    (approvedEndospheresPrice ||
      sourceContainsPrice(treatment, label.priceLabel)),
  );
}

function approvedPackageTreatment(
  locale: Locale,
  key: string,
  label: {
    group: string;
    name: string;
    durationLabel: string;
    priceLabel: string;
  },
  treatment: SourceTreatment,
): SourceTreatment {
  if (!key.startsWith("endospheres-")) return treatment;
  // Identity and price come from the clinic's approved package table; the copy
  // stays the one the page published.
  //
  // English used to have its description replaced with a sentence synthesised
  // from the PDF, while Finnish and Russian kept theirs. That dropped what the
  // old English page actually said about each package: "The procedure can be
  // performed on any selected area: legs, abdomen, buttocks, or back",
  // "Packages based on course recommendations": and left English covering only
  // 89% of its own page against 99% for the other two.
  return {
    ...treatment,
    group: label.group,
    name: label.name,
    durationLabel: label.durationLabel,
    priceLabel: label.priceLabel,
  };
}

function samePrice(expected: string, actual: string) {
  return normalize(expected) === normalize(actual.replace(/\s*\/\s*$/u, ""));
}

function sourceContainsPrice(treatment: SourceTreatment, expected: string) {
  const amount = expected.replace(/[^\d]/gu, "");
  return Boolean(
    amount &&
    `${treatment.priceLabel} ${treatment.description}`
      .replace(/[^\d]/gu, " ")
      .split(/\s+/u)
      .includes(amount),
  );
}

function htmlToMarkdown(value: string) {
  return normalizeRichTextMarkdown(
    turndown
      .turndown(value)
      .replace(/\\([.!])/gu, "$1")
      .replace(/[ \t]+\n/gu, "\n")
      .replace(/\n[ \t]+/gu, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/gu, " ")
      .trim(),
  );
}

function normalizeRegistryMarkdown(
  registry: Record<
    string,
    Record<string, Partial<Record<Locale, LocalizedTreatment>>>
  >,
) {
  for (const options of Object.values(registry)) {
    for (const localized of Object.values(options)) {
      for (const treatment of Object.values(localized)) {
        if (!treatment) continue;
        treatment.description = normalizeRichTextMarkdown(
          treatment.description,
        );
        treatment.summary = normalizeRichTextMarkdown(treatment.summary);
      }
    }
  }
}

/**
 * Records where each treatment's copy came from. The description is left
 * exactly as the source published it: nothing is appended, summarised or
 * paraphrased.
 */
function attributeRegistry(
  registry: Record<
    string,
    Record<string, Partial<Record<Locale, LocalizedTreatment>>>
  >,
) {
  for (const [service, options] of Object.entries(registry)) {
    for (const localized of Object.values(options)) {
      for (const treatment of Object.values(localized)) {
        if (!treatment) continue;
        treatment.description = treatment.description.trim();
        treatment.openingDescription = treatment.description;
        treatment.provenanceSourceIds = treatmentSourceIds(service);
      }
    }
  }
}

function extractSummary(markdown: string) {
  return extractMarkdownSummary(markdown);
}

function durationPart(value: string) {
  return (
    value.match(
      /(?:\d{1,3}\s*(?:–|-|—)\s*)?\d{1,3}\s*(?:min(?:ute)?s?|мин(?:ут[ы]?)?)/iu,
    )?.[0] ?? null
  );
}

function text(value: string) {
  return parse(value).textContent.replace(/\s+/gu, " ").trim();
}
function normalize(value: string) {
  return text(value)
    .toLocaleLowerCase()
    .replace(/[“”„«»'’`´]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function validateRegistry(
  registry: Record<
    string,
    Record<string, Partial<Record<Locale, LocalizedTreatment>>>
  >,
) {
  for (const [service, options] of Object.entries(registry)) {
    for (const [key, localized] of Object.entries(options)) {
      for (const [locale, treatment] of Object.entries(localized)) {
        if (!treatment?.description.trim() || !treatment.summary.trim())
          throw new Error(
            `Missing treatment copy for ${service}/${key}/${locale}`,
          );
        if (PROVENANCE.version !== TREATMENT_SOURCE_VERSION)
          throw new Error(
            `Treatment provenance version mismatch for ${service}/${key}/${locale}`,
          );
        // The description must be the source text verbatim. Any drift here means
        // something started generating copy again, which is what the clinic
        // rejected.
        if (treatment.description !== treatment.openingDescription)
          throw new Error(
            `Description is not the verbatim source text for ${service}/${key}/${locale}`,
          );
        for (const sourceId of treatment.provenanceSourceIds)
          if (!PROVENANCE.sources[sourceId])
            throw new Error(
              `Unknown provenance source ${sourceId} for ${service}/${key}/${locale}`,
            );
        if (
          /&(?:#\d+|#x[\da-f]+|[a-z]{2,});/iu.test(
            `${treatment.summary} ${treatment.description}`,
          )
        )
          throw new Error(
            `Undecoded HTML entity in ${service}/${key}/${locale}`,
          );
        if (
          malformedRichTextPattern.test(
            `${treatment.summary}\n${treatment.description}`,
          )
        )
          throw new Error(`Malformed rich text in ${service}/${key}/${locale}`);
        if (treatment.summary !== extractSummary(treatment.openingDescription))
          throw new Error(
            `Summary is not the first complete source block for ${service}/${key}/${locale}`,
          );
        if (/…\s*$/u.test(treatment.summary))
          throw new Error(
            `Generated terminal ellipsis in ${service}/${key}/${locale}`,
          );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
