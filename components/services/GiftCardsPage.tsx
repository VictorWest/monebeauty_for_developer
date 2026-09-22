import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/Markdown";
import { getLivePageContent } from "@/lib/live-content";
import { normalizeRichTextMarkdown } from "@/lib/markdown-normalization";
import {
  absoluteLocalizedUrl,
  breadcrumbJsonLd,
  excerpt,
  siteUrl,
  webPageJsonLd,
} from "@/lib/seo";
import { contentPagePath, productPath } from "@/lib/public-routes";
import { JsonLd } from "@/components/JsonLd";
import type { Locale } from "@/i18n/routing";

const copy = {
  en: { buy: "Buy now" },
  fi: { buy: "Osta nyt" },
  ru: { buy: "Купить" },
} as const;

type Card = { name: string; body: string[]; price: string | null };

const HEADING_FOUR = /^####\s+/u;
/** A price heading like "#### 50 € /" — digits/punctuation only, no letters,
 * which is what tells it apart from a heading that starts a new card. */
const PRICE_HEADING = /^####\s+[^\p{L}]*\d[^\p{L}]*$/u;

function headingText(block: string) {
  return block.replace(HEADING_FOUR, "").trim();
}

/** Every real shop gift card, by the € amount its price heading shows. */
const GIFT_CARD_PRODUCT_SLUG: Record<string, string> = {
  "50": "gift-card-50",
  "100": "gift-card-100",
  "350": "gift-card-350",
  "650": "gift-card-650",
  "1000": "gift-card-1000",
};

function parseCards(body: string): Card[] {
  const blocks = normalizeRichTextMarkdown(body)
    .split(/\n\s*\n/u)
    .map((block) => block.trim())
    .filter(Boolean);

  const cards: Card[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (HEADING_FOUR.test(block)) {
      if (PRICE_HEADING.test(block)) {
        const current = cards.at(-1);
        if (current) current.price = headingText(block);
        // The old site's dead "Into a basket" control follows every price.
        const next = blocks[index + 1];
        if (next && !HEADING_FOUR.test(next)) index += 1;
        continue;
      }
      cards.push({ name: headingText(block), body: [], price: null });
      continue;
    }
    cards.at(-1)?.body.push(block);
  }
  return cards;
}

/** The gift cards & membership page: a flat list of purchasable cards in the
 * source, not the legacy technology/service grammar, so it gets its own small
 * layout rather than the plain markdown dump ContentPage renders everything
 * else with. */
export async function GiftCardsPage({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const content = await getLivePageContent(slug, locale);
  if (!content) notFound();
  const path = contentPagePath(slug);
  const canonical = absoluteLocalizedUrl(siteUrl(), path, locale);
  const t = copy[locale];
  const cards = parseCards(content.body);

  return (
    <article className="bg-page py-[clamp(40px,5vw,72px)]">
      <JsonLd
        data={[
          webPageJsonLd({
            name: content.title,
            description: content.seoDescription || excerpt(content.body),
            url: canonical,
            image: content.hero,
            locale,
          }),
          breadcrumbJsonLd([
            {
              name: "Mone Beauty Clinic",
              url: absoluteLocalizedUrl(siteUrl(), "/", locale),
            },
            { name: content.title, url: canonical },
          ]),
        ]}
      />
      <Container className="max-w-280">
        <h1 className="font-display text-[clamp(32px,4.4vw,56px)] leading-[1.06] font-medium text-ink">
          {content.title}
        </h1>
        <div className="mt-8 flex flex-wrap justify-center gap-5">
          {cards.map((card) => {
            const amount = card.price?.match(/\d[\d\s.,]*/u)?.[0]?.replace(/[\s.,]/gu, "");
            const productSlug = amount ? GIFT_CARD_PRODUCT_SLUG[amount] : undefined;
            return (
              <article
                key={card.name + (card.price ?? "")}
                className="flex h-full w-full flex-col rounded-(--radius) border border-line-card bg-card p-[clamp(20px,3vw,28px)] shadow-(--shadow-card-soft) sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
              >
                <h3 className="font-display text-[clamp(23px,2.4vw,28px)] leading-[1.15] font-medium text-ink">
                  {card.name}
                </h3>
                {card.body.length ? (
                  <div className="mt-3 flex-1">
                    <Markdown
                      variant="treatment-summary"
                      className="[&_p]:text-[15px] [&_p]:leading-[1.65] [&_p]:text-body"
                    >
                      {card.body.join("\n\n")}
                    </Markdown>
                  </div>
                ) : (
                  <div className="flex-1" />
                )}
                <div className="mt-5 flex items-center justify-between gap-4 border-t border-line-hair pt-5">
                  {card.price ? (
                    <span className="font-display text-[26px] font-medium text-ink">
                      {card.price}
                    </span>
                  ) : null}
                  {productSlug ? (
                    <Button
                      href={productPath(productSlug)}
                      size="sm"
                      iconRight={ArrowRight}
                    >
                      {t.buy}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </article>
  );
}
