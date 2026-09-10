import {
  extractFirstBlockMarkdownSummary,
  extractLegacy60TokenMarkdownSummary,
  extractLegacyMarkdownSummary,
  extractMarkdownSummary,
} from "../lib/markdown-normalization";

/**
 * Marker left in rows written by the retired `procedure-editorial` generator.
 * The generator is gone, but databases synced before 2026-08-07 still hold its
 * paraphrased copy. Migrations treat a row carrying this marker as generated
 * rather than clinic-edited, so the real source text is allowed to replace it.
 *
 * A Markdown link-reference definition renders no UI.
 */
export const LEGACY_GENERATED_COPY_MARKER = "[procedure-editorial-v1]: #";

/**
 * Section headings the retired treatment enrichment appended to every record.
 *
 * Unlike the editorial layer it left no marker, so rows written by it match
 * neither the new source text nor any recorded history and would otherwise be
 * treated as clinic-edited and kept forever. Only the distinctive multi-word
 * headings are listed: "Benefits", "Preparation" and "Aftercare" also occur in
 * genuine clinic copy.
 */
const RETIRED_ENRICHMENT_HEADINGS = [
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

/**
 * True when copy was written by one of the retired generators rather than by
 * the clinic, and may therefore be replaced with the source text.
 *
 * Two independent headings must match, so a page that happens to use one of
 * these phrases as its own heading is never mistaken for generated copy.
 */
export function isRetiredGeneratedTreatmentCopy(
  value: string | null | undefined,
) {
  if (!value) return false;
  if (value.includes(LEGACY_GENERATED_COPY_MARKER)) return true;
  if (isSynthesisedPackageDescription(value)) return true;
  return (
    RETIRED_ENRICHMENT_HEADINGS.filter((heading) =>
      value.includes(`## ${heading}`),
    ).length >= 2
  );
}

/**
 * The English Endospheres package description this project used to synthesise
 * from the clinic PDF: "## Treatment Packages" followed by "### 30 min: 6
 * treatments": while Finnish and Russian kept the old site's own copy. English
 * covered only 89% of its own packages page as a result.
 *
 * Both markers are required so the manufacturer's recommendation, which is still
 * published on its own as a card summary, is not mistaken for it.
 */
function isSynthesisedPackageDescription(value: string) {
  return (
    value.trimStart().startsWith("## Treatment Packages") &&
    /^### \d+ min: \d+ treatments$/mu.test(value)
  );
}

export function isSourceOwnedTreatmentDescription(
  current: string | null | undefined,
  knownSourceDescriptions: readonly string[],
  historicalSourceDescriptions: readonly string[] = [],
) {
  if (!current?.trim()) return true;
  if (historicalSourceDescriptions.includes(current)) return true;
  return knownSourceDescriptions.includes(current);
}

export function isSourceOwnedTreatmentSummary(
  current: string | null | undefined,
  sourceDescriptions: readonly string[],
  currentSourceSummary: string,
  historicalSourceSummaries: readonly string[] = [],
) {
  if (!current?.trim()) return true;
  if (historicalSourceSummaries.includes(current)) return true;
  const sameSourceCopy = (candidate: string) =>
    current === candidate ||
    current.replace(/\s+/gu, " ").trim() ===
      candidate.replace(/\s+/gu, " ").trim();
  if (sameSourceCopy(currentSourceSummary)) return true;
  return sourceDescriptions.some(
    (description) =>
      sameSourceCopy(extractMarkdownSummary(description)) ||
      // The single-block extract this project used until 2026-08-07.
      sameSourceCopy(extractFirstBlockMarkdownSummary(description)) ||
      sameSourceCopy(extractLegacy60TokenMarkdownSummary(description)) ||
      sameSourceCopy(extractLegacyMarkdownSummary(description)),
  );
}
