export type Procedure = {
  group: string | null;
  title: string;
  description: string;
  price: string;
};

type ProcedureBlock = Procedure & {
  descriptionStart: number;
  descriptionEnd: number;
};

/**
 * Parses the approved procedure cards embedded in a service's localized Markdown body.
 * The returned array order is the public, one-based procedure identifier used by booking.
 */
export function parseProcedures(markdown: string): Procedure[] {
  return scanProcedureBlocks(markdown).map((block) => ({
    group: block.group,
    title: block.title,
    description: block.description,
    price: block.price,
  }));
}

/**
 * Replace only procedure-description spans while preserving headings, prices, ordering and
 * trailing media. Replacements are addressed by the same zero-based order used by booking.
 */
export function replaceProcedureDescriptions(
  markdown: string,
  replacements: ReadonlyMap<number, string>,
) {
  if (!replacements.size) return markdown;
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = scanProcedureBlocks(markdown);

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const replacement = replacements.get(index);
    if (!replacement) continue;
    const block = blocks[index];
    lines.splice(
      block.descriptionStart,
      block.descriptionEnd - block.descriptionStart,
      "",
      ...replacement.trim().split("\n"),
      "",
    );
  }

  return lines.join(newline);
}

function scanProcedureBlocks(markdown: string): ProcedureBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const procedures: ProcedureBlock[] = [];
  let group: string | null = null;
  let current: {
    title: string;
    description: string[];
    descriptionStart: number;
  } | null = null;

  for (const [lineIndex, line] of lines.entries()) {
    const trimmed = line.trim();
    if (/^##\s+Media\s*$/iu.test(trimmed)) break;
    const h3 = trimmed.match(/^###\s+(.+)$/);
    const h4 = trimmed.match(/^####\s+(.+)$/);

    if (h3) {
      if (current) {
        current.description.push(line);
      } else if (headsItsOwnCard(lines, lineIndex)) {
        // The last card on the eyebrow page titles itself with `###` and never
        // opens a `####` of its own. Treated as a group it took its whole
        // description down with it, so a complete treatment vanished from the
        // site in all three locales.
        current = {
          title: cleanInlineMarkdown(h3[1]),
          description: [],
          descriptionStart: lineIndex + 1,
        };
      } else {
        group = cleanInlineMarkdown(h3[1]);
      }
      continue;
    }

    if (h4) {
      const heading = cleanInlineMarkdown(h4[1]);
      if (isPriceLine(heading)) {
        if (current) {
          const description = cleanDescription(current.description.join("\n"));
          if (description) {
            procedures.push({
              group,
              title: current.title,
              description,
              price: heading,
              descriptionStart: current.descriptionStart,
              descriptionEnd: lineIndex,
            });
          }
          current = null;
        }
      } else if (current) {
        // Scraped copy legitimately uses h4 subheadings such as Benefits, Results and Course.
        // A new procedure begins only after the previous title has been closed by a price line.
        current.description.push(line);
      } else {
        current = {
          title: heading,
          description: [],
          descriptionStart: lineIndex + 1,
        };
      }
      continue;
    }

    if (current && !isBasketMarker(trimmed)) current.description.push(line);
  }

  return procedures;
}

/** Resolve a one-based public index without accepting coercions or partial numbers. */
export function resolveProcedure(
  markdown: string,
  index: unknown,
): { index: number; procedure: Procedure } | null {
  const parsedIndex =
    typeof index === "number"
      ? index
      : typeof index === "string" && /^\d+$/.test(index)
        ? Number(index)
        : Number.NaN;
  if (!Number.isSafeInteger(parsedIndex) || parsedIndex < 1) return null;
  const procedure = parseProcedures(markdown)[parsedIndex - 1];
  return procedure ? { index: parsedIndex, procedure } : null;
}

/**
 * True when an `###` heading is a card title rather than a group name: the next
 * heading of either level closes a card with a price, so no `####` title ever
 * follows it.
 */
function headsItsOwnCard(lines: string[], headingIndex: number) {
  for (const line of lines.slice(headingIndex + 1)) {
    const trimmed = line.trim();
    if (/^##\s+Media\s*$/iu.test(trimmed)) return false;
    if (/^###\s+/u.test(trimmed)) return false;
    const h4 = trimmed.match(/^####\s+(.+)$/u);
    if (h4) return isPriceLine(cleanInlineMarkdown(h4[1]));
  }
  return false;
}

/**
 * A card is closed by its published price, which always carries a currency.
 *
 * Matching a bare duration instead ("…|\d+\s*min") mistook Finnish package
 * titles such as "30 minuutin hoitopaketit 6 kerta" for price lines, so eight
 * of the twenty-five Finnish packages were parsed as the end of a card that had
 * never been opened and vanished from the site. Every one of the 161 genuine
 * price headings across all pages and locales carries a currency symbol.
 */
function isPriceLine(value: string) {
  return /(?:€|\beur\b)/iu.test(value);
}

function isBasketMarker(value: string) {
  return /^(?:into a basket|koriin|в корзину)$/iu.test(value);
}

function cleanInlineMarkdown(value: string) {
  return value.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function cleanDescription(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
