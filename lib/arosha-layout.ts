import { normalizeRichTextMarkdown } from "@/lib/markdown-normalization";

export type AroshaProgram = {
  name: string;
  body: string[];
  price: string | null;
};

export type AroshaSpec = {
  label: string;
  value: string;
};

export type AroshaLayout = {
  /** The opening paragraph, for the hero. */
  lead: string;
  /** Section heading + prose that opens the article. */
  intro: string[];
  introImages: string[];
  /** The flattened spec table, paired back into label/value rows. */
  specHeading: string | null;
  specs: AroshaSpec[];
  programsHeading: string | null;
  programs: AroshaProgram[];
  /** The closing section, minus the dead form control. */
  closingHeading: string | null;
  closing: string[];
  closingImages: string[];
  /** Blocks dropped as dead scrape artifacts, for the test to assert against. */
  dropped: string[];
  orderedTextBlocks: string[];
};

const IMAGE_BLOCK = /^!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/u;
const HEADING_TWO = /^##\s+(?!#)/u;
const HEADING_FOUR = /^####\s+/u;
const ANY_HEADING = /^#{1,6}\s+/u;
/**
 * A price heading such as `#### 70 € /`.
 *
 * Requiring "no letters" rather than "contains a digit" is what separates it
 * from a program named `#### Super Combo 1`, which would otherwise be read as
 * the previous program's price and swallow its description.
 */
const PRICE_HEADING = /^####\s+[^\p{L}]*\d[^\p{L}]*$/u;

function imageSource(block: string) {
  return block.match(IMAGE_BLOCK)?.[1] ?? null;
}

function textOf(block: string) {
  return block
    .replace(/^#{1,6}\s+/u, "")
    .replace(/\*\*/gu, "")
    .replace(/\s*\/\s*$/u, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/gu, "$1")
    .trim();
}

/**
 * Partitions the Arosha page, which does not follow the technology grammar.
 *
 * Its source is a body-wrap article, a spec table the scraper flattened into
 * alternating label and value paragraphs, seven treatment programs written as
 * `#### NAME` / description / `#### PRICE`, and a signup section. The old site's
 * cart and form controls survive the scrape as bare text blocks — "Into a
 * basket" after every price, and the submit label before the closing image —
 * and are reported in `dropped` rather than rendered.
 */
export function parseAroshaMarkdown(markdown: string): AroshaLayout {
  const source = normalizeRichTextMarkdown(markdown)
    .split(/\n\s*\n/u)
    .map((block) => block.trim())
    .filter(Boolean);
  const orderedTextBlocks = source.filter((block) => !imageSource(block));

  // The programs section is whichever heading introduces the first `####`
  // block; naming it structurally avoids matching a localized title.
  const firstProgramHeading = source.findIndex((block) =>
    HEADING_FOUR.test(block),
  );
  const programsHeadingIndex =
    firstProgramHeading > 0
      ? source
          .slice(0, firstProgramHeading)
          .map((block, index) => (ANY_HEADING.test(block) ? index : -1))
          .filter((index) => index >= 0)
          .at(-1) ?? -1
      : -1;
  // The spec table sits under the last second-level heading before the programs.
  const specHeadingIndex =
    programsHeadingIndex > 0
      ? source
          .slice(0, programsHeadingIndex)
          .map((block, index) => (HEADING_TWO.test(block) ? index : -1))
          .filter((index) => index > 0)
          .at(-1) ?? -1
      : -1;
  const programsEnd = (() => {
    if (programsHeadingIndex < 0) return source.length;
    const next = source.findIndex(
      (block, index) => index > programsHeadingIndex && HEADING_TWO.test(block),
    );
    return next >= 0 ? next : source.length;
  })();

  const introEnd = specHeadingIndex >= 0 ? specHeadingIndex : programsEnd;
  const introSlice = source.slice(0, introEnd);
  const withoutImages = introSlice.filter((block) => !imageSource(block));
  const introImages = introSlice.flatMap((block) => {
    const src = imageSource(block);
    return src ? [src] : [];
  });
  // The opening paragraph becomes the hero lead, so it is lifted out of the
  // body rather than printed a second time underneath it.
  const lead =
    withoutImages.find((block) => !ANY_HEADING.test(block) && block.length > 80) ??
    "";
  const intro = withoutImages.filter((block) => block !== lead);

  const dropped: string[] = [];

  // Label/value rows, in source order.
  const specs: AroshaSpec[] = [];
  if (specHeadingIndex >= 0) {
    const rows = source
      .slice(specHeadingIndex + 1, programsHeadingIndex)
      .filter((block) => !imageSource(block));
    for (let index = 0; index + 1 < rows.length; index += 2) {
      specs.push({ label: textOf(rows[index]), value: rows[index + 1] });
    }
  }

  const programs: AroshaProgram[] = [];
  if (programsHeadingIndex >= 0) {
    const rows = source.slice(programsHeadingIndex + 1, programsEnd);
    for (let index = 0; index < rows.length; index += 1) {
      const block = rows[index];
      if (imageSource(block)) continue;
      if (HEADING_FOUR.test(block)) {
        if (PRICE_HEADING.test(block)) {
          const current = programs.at(-1);
          if (current) current.price = textOf(block);
          // The old site's add-to-cart control follows every price.
          const next = rows[index + 1];
          if (next && !ANY_HEADING.test(next) && !imageSource(next)) {
            dropped.push(next);
            index += 1;
          }
          continue;
        }
        programs.push({ name: textOf(block), body: [], price: null });
        continue;
      }
      programs.at(-1)?.body.push(block);
    }
  }

  const closingSlice = source.slice(programsEnd);
  const closingHeading = closingSlice.find((block) => HEADING_TWO.test(block));
  const closingBody = closingSlice.filter(
    (block) => !imageSource(block) && block !== closingHeading,
  );
  // The submit control is a bare label with no sentence punctuation.
  const submitIndex = closingBody.findIndex(
    (block) =>
      !ANY_HEADING.test(block) && block.length < 30 && !/[.!?:]$/u.test(block),
  );
  const closing = closingBody.filter((block, index) => {
    if (index !== submitIndex) return true;
    dropped.push(block);
    return false;
  });
  const closingImages = closingSlice.flatMap((block) => {
    const src = imageSource(block);
    return src ? [src] : [];
  });

  return {
    lead,
    intro,
    introImages,
    specHeading: specHeadingIndex >= 0 ? source[specHeadingIndex] : null,
    specs,
    programsHeading:
      programsHeadingIndex >= 0 ? source[programsHeadingIndex] : null,
    programs,
    closingHeading: closingHeading ?? null,
    closing,
    closingImages,
    dropped,
    orderedTextBlocks,
  };
}
