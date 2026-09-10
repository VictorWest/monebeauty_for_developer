const MALFORMED_STRONG_BOUNDARY =
  /(?<![\\\p{L}\p{N}])([\p{L}\p{N}]+)\*\*([\p{L}\p{N}%€][^*\n]*?)\*\*/gu;

function normalizeBulletLine(line: string) {
  if (!/(?<!\\)•/u.test(line)) return [line];

  const parts = line.split(/\s*(?<!\\)•\s*/u);
  const introduction = parts.shift()?.trimEnd() ?? "";
  const items = parts.map((part) => part.trim()).filter(Boolean);
  if (!items.length) return [line];

  const list = items.map((item) => `- ${item}`);
  return introduction ? [introduction, "", ...list] : list;
}

/**
 * Cleans the small, known set of Markdown defects produced by the legacy HTML
 * import without changing copy or punctuation.
 *
 * In particular, legacy bullet glyphs become real lists and strong markers
 * accidentally inserted inside a word or number are moved to that token's
 * boundary (`10**% ...**` -> `**10% ...**`). Escaped bullet glyphs and all
 * other symbols are left untouched.
 */
export function normalizeRichTextMarkdown(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .flatMap(normalizeBulletLine)
    .join("\n")
    .replace(MALFORMED_STRONG_BOUNDARY, "**$1$2**")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

/**
 * Promotes legacy treatment section labels into real level-two headings.
 *
 * Source descriptions use bold-only lines for structural labels such as
 * `**Course:**` and `**What results can you expect?**`. Only colon- or
 * question-mark-ended labels at the start of a line are promoted, leaving
 * inline/list emphasis and ordinary bold statements untouched.
 */
export function promoteTreatmentDetailSectionHeadings(value: string) {
  return value.replace(
    /^\*\*([^*\n]+[:?])\*\*[\t \u00a0]*(?=\n|$)/gmu,
    "## $1",
  );
}

function plainMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[#*_>`~\-–—•]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function markdownWordCount(value: string) {
  const plain = plainMarkdown(value);
  return plain ? plain.split(/\s+/u).length : 0;
}

function markdownTokenCount(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

type SummaryBlock = { text: string; heading: boolean };

/**
 * Splits source Markdown into summary candidates, keeping headings in place.
 *
 * Headings are flagged rather than discarded: an extract that steps over one
 * would stitch together two paragraphs that are not adjacent in the source,
 * and stop being a verbatim quote of it.
 */
function summaryBlocks(value: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];

  for (const sourceBlock of normalizeRichTextMarkdown(value).split(
    /\n\s*\n/u,
  )) {
    const block = sourceBlock.trim();
    if (!block) continue;
    if (/^#{1,6}\s+/u.test(block)) {
      blocks.push({ text: block, heading: true });
      continue;
    }

    const isList = /^(?:[-+*]|\d+\.)\s+/u.test(block);
    const previous = blocks.at(-1);
    if (
      isList &&
      previous &&
      !previous.heading &&
      /^(?:[-+*]|\d+\.)\s+/u.test(previous.text)
    ) {
      previous.text = `${previous.text}\n${block}`;
    } else {
      blocks.push({ text: block, heading: false });
    }
  }

  return blocks;
}

function legacySummaryBlocks(value: string) {
  const blocks: string[] = [];
  for (const sourceBlock of normalizeRichTextMarkdown(value).split(
    /\n\s*\n/u,
  )) {
    const block = sourceBlock.replace(/^#{1,6}\s+/u, "").trim();
    if (!block) continue;
    const isList = /^(?:[-+*]|\d+\.)\s+/u.test(block);
    const previous = blocks.at(-1);
    if (isList && previous && /^(?:[-+*]|\d+\.)\s+/u.test(previous))
      blocks[blocks.length - 1] = `${previous}\n${block}`;
    else blocks.push(block);
  }
  return blocks;
}

function truncateMarkdownWords(value: string, maximumTokens: number) {
  if (markdownTokenCount(value) <= maximumTokens) return value;

  const parts = value.split(/(\s+)/u);
  const selected: string[] = [];
  let tokens = 0;

  for (const part of parts) {
    if (!part) continue;
    const partTokens = /\s/u.test(part) ? 0 : 1;
    if (partTokens && tokens + partTokens > maximumTokens) break;
    selected.push(part);
    tokens += partTokens;
    if (tokens >= maximumTokens) break;
  }

  let summary = selected
    .join("")
    .trimEnd()
    .replace(/[,;:]$/u, "");
  const strongBoundaries = summary.match(/(?<!\\)\*\*/gu)?.length ?? 0;
  if (strongBoundaries % 2) summary += "**";
  return `${summary}…`;
}

/** A block that is nothing but a section name, e.g. "Benefits:" or "Course". */
function isBareSectionKeyword(block: string) {
  return /^(?:benefits|results|course|indications|contraindications|hyödyt|tulokset|показания|результаты)\s*:?$/iu.test(
    plainMarkdown(block),
  );
}

/**
 * Blocks whose only job is to introduce what follows them:
 * "Benefits of the treatment:", "What results can you expect?", "Kurssi:".
 */
function isSectionLabel(block: string) {
  const plain = plainMarkdown(block);
  if (isBareSectionKeyword(block)) return true;
  return /[:?]\s*$/u.test(plain) && markdownTokenCount(plain) <= 10;
}

function isListBlock(block: string) {
  return /^(?:[-+*]|\d+\.)\s+/u.test(block);
}

/** A standalone published price, e.g. "65 € / 30 min". */
function isPriceBlock(block: string) {
  return /(?:€|\bEUR\b|\beur\b)/u.test(plainMarkdown(block));
}

/**
 * A card summary must be long enough to fill the card without becoming the
 * whole description. Whole blocks are kept or dropped: copy is never cut
 * mid-sentence and no punctuation is synthesized.
 */
const SUMMARY_MAX_WORDS = 60;

/**
 * Selects the source's opening prose: the leading run of paragraphs before the
 * description turns into a new section.
 *
 * Taking only the first block used to strip the lines the clinic cares most
 * about: "Procedure for one area" kept its heading but lost the "Duration: 30
 * minutes / Area of choice: legs, abdomen, buttocks, back" that followed it,
 * which left the treatment cards looking almost empty.
 *
 * A short colon-ended introduction still stays attached to the list it
 * introduces.
 */
/**
 * Migration-only reproduction of the superseded single-block extraction.
 *
 * Until 2026-08-07 a summary was the first source block alone, which dropped
 * the "Duration / Area of choice" lines that followed it. Sync guards use this
 * to recognise a stored summary as one this project generated, rather than one
 * the clinic wrote, so it can be replaced with the fuller extract.
 */
export function extractFirstBlockMarkdownSummary(value: string) {
  const blocks = summaryBlocks(value);
  for (const [index, block] of blocks.entries()) {
    if (block.heading) continue;
    if (isBareSectionKeyword(block.text)) continue;
    if (!markdownWordCount(block.text)) continue;
    const next = blocks[index + 1];
    if (
      /:\s*$/u.test(block.text) &&
      next &&
      !next.heading &&
      isListBlock(next.text)
    )
      return `${block.text}\n\n${next.text}`;
    return block.text;
  }
  return "";
}

export function extractMarkdownSummary(value: string) {
  const blocks = summaryBlocks(value);
  // Structural headings above the opening prose ("# Endosphere therapy") are
  // the page's own title and are skipped, exactly as before. A label is skipped
  // only when it introduces prose: the prose is then the real summary. A label
  // introducing a list is kept, because the list is what it announces.
  const start = blocks.findIndex((block, index) => {
    if (block.heading || !markdownWordCount(block.text)) return false;
    if (isBareSectionKeyword(block.text)) return false;
    if (!isSectionLabel(block.text)) return true;
    const following = blocks[index + 1];
    return Boolean(
      following && !following.heading && isListBlock(following.text),
    );
  });
  if (start < 0) return "";

  const first = blocks[start].text;
  const next = blocks[start + 1];
  if (/:\s*$/u.test(first) && next && !next.heading && isListBlock(next.text))
    return `${first}\n\n${next.text}`;

  const selected = [first];
  let words = markdownWordCount(first);
  for (const block of blocks.slice(start + 1)) {
    if (
      block.heading ||
      isListBlock(block.text) ||
      isPriceBlock(block.text) ||
      isSectionLabel(block.text)
    )
      break;
    if (words >= SUMMARY_MAX_WORDS) break;
    selected.push(block.text);
    words += markdownWordCount(block.text);
  }
  return selected.join("\n\n");
}

/**
 * Removes an exact hero summary from the opening prefix of its source
 * Markdown. Leading structural headings stay in the detail body, while the
 * whole matching summary is consumed so a multi-block semantic list cannot
 * leave duplicated items behind.
 */
export function removeRepeatedMarkdownSummary(
  description: string,
  summary: string,
) {
  const source = description.trimStart();
  const prefix = summary.trim();
  if (!prefix) return description;
  const prefixStart = source.indexOf(prefix);
  if (prefixStart < 0) return description;
  const leadingBlocks = source
    .slice(0, prefixStart)
    .trim()
    .split(/\n\s*\n/u)
    .map((block) => block.trim())
    .filter(Boolean);
  // Only structural lead-ins may sit above the hero summary. A section label
  // ("**Toimenpiteen kuvaus:**") introduced the very paragraph that has moved
  // into the hero, so it is dropped with it; a real heading titles the whole
  // card and stays in the detail body.
  if (
    !leadingBlocks.every(
      (block) => /^#{1,6}\s+[^\n]+$/u.test(block) || isSectionLabel(block),
    )
  )
    return description;
  const leading = leadingBlocks
    .filter((block) => /^#{1,6}\s+[^\n]+$/u.test(block))
    .join("\n\n");
  const prefixEnd = prefixStart + prefix.length;
  const boundary = source.slice(prefixEnd, prefixEnd + 1);
  if (boundary && !/\s/u.test(boundary)) return description;
  const remainder = source.slice(prefixEnd).replace(/^\s+/u, "");
  return leading ? `${leading}\n\n${remainder}`.trimEnd() : remainder;
}

/** Migration-only reproduction of the superseded 60-token summary generator. */
export function extractLegacyMarkdownSummary(value: string) {
  return extractLegacySummary(value, true);
}

/** Migration-only reproduction of the earlier strict 60-token variant. */
export function extractLegacy60TokenMarkdownSummary(value: string) {
  return extractLegacySummary(value, false);
}

function extractLegacySummary(value: string, stopAtMinimumWords: boolean) {
  const selected: string[] = [];
  let plainWords = 0;
  let tokens = 0;
  for (const block of legacySummaryBlocks(value)) {
    const blockWords = markdownWordCount(block);
    const blockTokens = markdownTokenCount(block);
    if (!blockWords) continue;
    if (tokens + blockTokens <= 60) {
      selected.push(block);
      plainWords += blockWords;
      tokens += blockTokens;
    } else if (plainWords < 30 || !stopAtMinimumWords) {
      const truncated = truncateMarkdownWords(block, 60 - tokens);
      selected.push(truncated);
      plainWords += markdownWordCount(truncated);
      tokens = 60;
    }
    if (tokens >= 60 || (stopAtMinimumWords && plainWords >= 30)) break;
  }
  return selected.join("\n\n");
}

export const malformedRichTextPattern =
  /(?<!\\)•|(?<![\\\p{L}\p{N}])[\p{L}\p{N}]+\*\*[\p{L}\p{N}%€]/u;
