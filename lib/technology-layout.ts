import { normalizeRichTextMarkdown } from "@/lib/markdown-normalization";

export type TechnologyChapter = {
  heading: string;
  body: string[];
};

/**
 * A lead-in block (a colon line, a bold claim, a heading) together with the
 * list that belongs to it. Endospheres carries one; the laser page carries two.
 */
export type TechnologyIntroGroup = {
  leadIn: string;
  items: string[];
};

export type TechnologyLayout = {
  heroLead: string;
  intro: string[];
  /** The intro's opening claim, when it is a title rather than a list lead-in. */
  introTitle: string | null;
  /** Lead-in + list runs, for the intro's key-points panel. */
  introGroups: TechnologyIntroGroup[];
  /** Intro prose that belongs beside the heading rather than in the panel. */
  introNarrative: string[];
  overview: string[];
  benefits: TechnologyChapter[];
  booking: string | null;
  /** The source link's own label, so the clinic's wording still drives the CTA. */
  bookingLabel: string | null;
  /** The source link target, or `null` when it points at the previous site. */
  bookingHref: string | null;
  safety: TechnologyChapter[];
  stages: TechnologyChapter[];
  /**
   * Every chapter after the last stage. Laser's Russian copy sets "На лице:" and
   * "На теле:" as headings where English uses bold text, so the device section
   * is three chapters there and one elsewhere: keeping only the first dropped
   * two sections of published copy.
   */
  sensorChapters: TechnologyChapter[];
  sensor: TechnologyChapter | null;
  /** Every image the source supplies for the overview band, in source order. */
  overviewImages: string[];
  /**
   * Every image from the safety block onwards, in source order. The source
   * places each photo immediately before the stage it illustrates, so index `i`
   * belongs to stage `i` and the remainder closes the sensor section.
   */
  processImages: string[];
  overviewImage: string | null;
  processImage: string | null;
  fallback: string[];
  /** Exact source blocks, excluding image-only blocks, for lossless-copy tests. */
  orderedTextBlocks: string[];
};

const IMAGE_BLOCK = /^!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/u;
const HEADING_ONE = /^#\s+/u;
const HEADING_TWO = /^##\s+/u;
const BENEFIT_HEADING = /^-\s+###\s+/u;
const HEADING_THREE = /^###\s+(?!#)/u;
/**
 * A protocol step, as opposed to the device chapter that closes the page.
 *
 * The steps are numbered but the numeral does not always lead: Endospheres and
 * laser write "### 1 Stage" / "### 1. Consultation", microneedle RF writes
 * "### Step 1". Matching any third-level heading that contains a digit covers
 * all of them, and no device heading on any page contains one.
 */
const STAGE_HEADING = /^###\s+(?!#)(?=.*\d)/u;
const ANY_HEADING = /^#{1,6}\s+/u;
const STANDALONE_STRONG = /^\*\*[^\n]+\*\*$/u;
const LIST_ITEM = /^(?:[-+*]|\d+\.)\s+/u;
const LINK_BLOCK = /^\[([^\]]+)\]\(([^)]+)\)$/u;

/**
 * Booking URLs carried over from the previous site, in all three locales.
 *
 * Endospheres and laser link relatively (`/EN/booking/`); microneedle RF links
 * absolutely to the old domain, which would take a visitor off this site
 * entirely, so both shapes have to be recognised.
 */
const LEGACY_BOOKING_HREF =
  /^(?:https?:\/\/(?:www\.)?monebeauty\.fi)?\/(?:[a-z]{2}\/)?booking\/?$/iu;

/**
 * Reads the clinic's own call to action out of the source block.
 *
 * The scraped copy still points at the previous site's booking URLs
 * (`/EN/booking/`, `/booking/`, `/RU/booking/`), none of which this site
 * serves. Keep the link text exactly as written and report `href: null` for
 * those, so the caller can send the reader to the live booking route instead.
 */
function bookingTarget(block: string | null) {
  const match = block?.match(LINK_BLOCK);
  if (!match) return { label: null, href: null };
  const [, label, href] = match;
  const target = href.trim();
  return {
    label: label.trim(),
    href: LEGACY_BOOKING_HREF.test(target) ? null : target,
  };
}

function imagesIn(source: string[]) {
  return source.flatMap((block) => {
    const src = imageSource(block);
    return src ? [src] : [];
  });
}

function blocks(markdown: string) {
  return normalizeRichTextMarkdown(markdown)
    .split(/\n\s*\n/u)
    .map((block) => block.trim())
    .filter(Boolean);
}

function imageSource(block: string) {
  return block.match(IMAGE_BLOCK)?.[1] ?? null;
}

/**
 * Splits the intro into its key-points panel and the prose beside the heading.
 *
 * Every one of these pages opens with a claim, one or more "this helps to:"
 * lead-ins each followed by a bullet list, and some free paragraphs: but not
 * in a fixed order or count. A group is a lead-in plus the list items directly
 * after it; when a page writes its list as prose instead of bullets (Finnish
 * Endospheres) the lead-in still pairs with the block that follows.
 */
function groupIntro(body: string[]) {
  const groups: TechnologyIntroGroup[] = [];
  const narrative: string[] = [];
  const leadInIndexes = new Set<number>();

  for (let index = 0; index < body.length; ) {
    let end = index + 1;
    while (end < body.length && LIST_ITEM.test(body[end])) end += 1;
    if (end > index + 1) {
      leadInIndexes.add(index);
      groups.push({ leadIn: body[index], items: body.slice(index + 1, end) });
      index = end;
      continue;
    }
    narrative.push(body[index]);
    index += 1;
  }

  // No bullets anywhere: pair a colon-terminated lead-in with the next block so
  // the panel still reads as a list rather than collapsing into the prose.
  if (!groups.length) {
    const colon = narrative.findIndex(
      (block, index) => /:\s*$/u.test(block) && index + 1 < narrative.length,
    );
    if (colon >= 0) {
      groups.push({ leadIn: narrative[colon], items: [narrative[colon + 1]] });
      narrative.splice(colon, 2);
      leadInIndexes.add(colon);
    }
  }

  // The opening claim is a title only when it is not itself a list lead-in.
  const first = narrative[0];
  const title =
    first && !leadInIndexes.has(0) && (ANY_HEADING.test(first) || STANDALONE_STRONG.test(first))
      ? narrative.shift() ?? null
      : null;

  return { title, groups, narrative };
}

function chapterGroups(source: string[], heading: RegExp) {
  const chapters: TechnologyChapter[] = [];
  const fallback: string[] = [];

  for (const block of source) {
    if (imageSource(block)) continue;
    if (heading.test(block)) {
      chapters.push({ heading: block, body: [] });
      continue;
    }
    const chapter = chapters.at(-1);
    if (chapter) chapter.body.push(block);
    else fallback.push(block);
  }

  return { chapters, fallback };
}

/**
 * Partitions a legacy technology page without rewriting its copy.
 *
 * Endospheres, laser hair removal, microneedle RF and trichology all share one
 * markdown grammar: an intro, a titled overview, `- ###` benefit chapters, a
 * booking link, indications and contraindications, numbered protocol steps and
 * a closing device chapter.
 *
 * The source is intentionally kept as raw Markdown blocks. Rendering may
 * promote a heading or move a paragraph into the hero, but every visible text
 * block remains byte-for-byte identical and in source order. Unknown blocks
 * are retained in `fallback` instead of being discarded.
 */
export function parseTechnologyMarkdown(markdown: string): TechnologyLayout {
  const source = blocks(markdown);
  const orderedTextBlocks = source.filter((block) => !imageSource(block));
  const h1Index = source.findIndex((block) => HEADING_ONE.test(block));
  const benefitIndex = source.findIndex((block) => BENEFIT_HEADING.test(block));
  const bookingIndex = source.findIndex(
    (block, index) => index > benefitIndex && LINK_BLOCK.test(block),
  );
  const stageIndex = source.findIndex(
    (block, index) => index > bookingIndex && STAGE_HEADING.test(block),
  );
  const sensorIndex = source.findIndex(
    (block, index) =>
      index > stageIndex &&
      HEADING_THREE.test(block) &&
      !STAGE_HEADING.test(block),
  );

  const introEnd = h1Index >= 0 ? h1Index : Math.max(benefitIndex, 0);
  const heroIndex = source.findIndex(
    (block, index) =>
      index < introEnd &&
      !imageSource(block) &&
      !ANY_HEADING.test(block) &&
      !STANDALONE_STRONG.test(block) &&
      !LINK_BLOCK.test(block) &&
      !/^(?:[-+*]|\d+\.)\s+/u.test(block) &&
      !/:\s*$/u.test(block),
  );
  const heroLead = heroIndex >= 0 ? source[heroIndex] : "";

  const intro = source
    .slice(0, introEnd)
    .filter((block, index) => index !== heroIndex && !imageSource(block));

  const overviewEnd = benefitIndex >= 0 ? benefitIndex : source.length;
  const overviewSlice = source.slice(Math.max(h1Index, 0), overviewEnd);
  const overview = overviewSlice.filter((block) => !imageSource(block));
  const overviewImages = imagesIn(overviewSlice);

  const benefitsEnd = bookingIndex >= 0 ? bookingIndex : overviewEnd;
  const benefitGroups = chapterGroups(
    benefitIndex >= 0 ? source.slice(benefitIndex, benefitsEnd) : [],
    BENEFIT_HEADING,
  );
  const booking = bookingIndex >= 0 ? source[bookingIndex] : null;

  const safetyEnd = stageIndex >= 0 ? stageIndex : source.length;
  const safetyStart = bookingIndex >= 0 ? bookingIndex + 1 : benefitsEnd;
  const safetySlice = source.slice(safetyStart, safetyEnd);
  const safetyGroups = chapterGroups(safetySlice, HEADING_TWO);
  // Each process photo sits immediately before the stage it illustrates, so
  // reading from the safety block onwards keeps photo and stage aligned.
  const processImages = imagesIn(source.slice(safetyStart));

  const stageEnd = sensorIndex >= 0 ? sensorIndex : source.length;
  const stageGroups = chapterGroups(
    stageIndex >= 0 ? source.slice(stageIndex, stageEnd) : [],
    STAGE_HEADING,
  );
  const sensorGroups = chapterGroups(
    sensorIndex >= 0 ? source.slice(sensorIndex) : [],
    HEADING_THREE,
  );

  const fallback = [
    ...benefitGroups.fallback,
    ...safetyGroups.fallback,
    ...stageGroups.fallback,
    ...sensorGroups.fallback,
  ];

  const { label: bookingLabel, href: bookingHref } = bookingTarget(booking);
  const {
    title: introTitle,
    groups: introGroups,
    narrative: introNarrative,
  } = groupIntro(intro.slice(1));

  return {
    heroLead,
    intro,
    introTitle,
    introGroups,
    introNarrative,
    overview,
    benefits: benefitGroups.chapters,
    booking,
    bookingLabel,
    bookingHref,
    safety: safetyGroups.chapters,
    stages: stageGroups.chapters,
    sensorChapters: sensorGroups.chapters,
    sensor: sensorGroups.chapters[0] ?? null,
    overviewImages,
    processImages,
    overviewImage: overviewImages[0] ?? null,
    processImage: processImages[0] ?? null,
    fallback,
    orderedTextBlocks,
  };
}

/**
 * Flattens inline Markdown for places that render as plain text.
 *
 * The hero lead is a real source paragraph, and microneedle RF's opening
 * paragraph emphasises phrases mid-sentence: printed verbatim into a `<p>`
 * those asterisks show up on screen.
 */
export function plainText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/gu, "$2")
    .replace(/(\*|_)(?=\S)([\s\S]*?\S)\1/gu, "$2")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * The visible text of a heading block.
 *
 * Headings are rendered as plain strings rather than through Markdown, so any
 * escape the source carries has to be resolved here: the published Russian
 * laser copy writes "### 1\. Консультация", which otherwise shows its
 * backslash on screen.
 */
export function sourceHeadingText(markdown: string) {
  return markdown
    .replace(/^-\s+/u, "")
    .replace(/^#{1,6}\s+/u, "")
    .replace(/^\*\*|\*\*$/gu, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/gu, "$1")
    .trim();
}
