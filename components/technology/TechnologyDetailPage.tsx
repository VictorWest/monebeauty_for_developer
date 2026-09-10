import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { Markdown } from "@/components/Markdown";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getPublishedTechnologyByPath } from "@/lib/live-content";
import type { Locale } from "@/i18n/routing";
import { ServiceOptionSelector } from "@/components/services/ServiceOptionSelector";
import { TechnologyEditorial } from "@/components/technology/TechnologyEditorial";
import { TechnologyTreatmentCards } from "@/components/technology/TechnologyTreatmentCards";
import { EndospheresBookingPanel } from "@/components/technology/EndospheresBookingPanel";
import { TechnologyStickyBook } from "@/components/technology/TechnologyStickyBook";
import { parseTechnologyMarkdown, plainText } from "@/lib/technology-layout";
import { JsonLd } from "@/components/JsonLd";
import {
  absoluteLocalizedUrl,
  breadcrumbJsonLd,
  siteUrl,
  webPageJsonLd,
} from "@/lib/seo";

const endospheresHeroCta = {
  en: "Book now",
  fi: "Varaa nyt",
  ru: "Записаться",
} as const;

/**
 * Pages whose body follows the legacy technology grammar and so can be laid out
 * as an editorial article rather than dumped as one column of markdown.
 */
const EDITORIAL_SLUGS = new Set(["endospheres", "laser", "rf", "trichology"]);

/** The section a hero CTA and the small-screen bar jump to, per layout. */
const BOOKING_ANCHOR = {
  endospheres: "endospheres-booking",
  treatments: "technology-treatments",
} as const;

/**
 * The lowest-priced treatment, so the hero quotes a real entry price.
 *
 * Options are ordered by the clinic's display order, not by price, and laser
 * runs from €25 to €1000: taking the first would have quoted an arbitrary one.
 */
function cheapest<T extends { priceLabel: string | null }>(options: T[]) {
  let best: T | undefined;
  let bestPrice = Number.POSITIVE_INFINITY;
  for (const option of options) {
    const digits = option.priceLabel?.match(/\d[\d\s.,]*/u)?.[0];
    if (!digits) continue;
    const price = Number(digits.replace(/[\s.,]/gu, ""));
    if (!Number.isFinite(price) || price >= bestPrice) continue;
    bestPrice = price;
    best = option;
  }
  return best ?? options[0];
}

export async function TechnologyDetailPage({
  path,
  locale,
}: {
  path: string;
  locale: Locale;
}) {
  const technology = await getPublishedTechnologyByPath(path, locale);
  if (!technology) notFound();
  const isEndospheres = technology.slug === "endospheres";
  const isEditorial = EDITORIAL_SLUGS.has(technology.slug);
  const layout = isEditorial
    ? parseTechnologyMarkdown(technology.content.body)
    : null;
  // `content.summary` is a machine excerpt that runs headings together and ends
  // in an ellipsis; the body's own opening paragraph reads as written. It is a
  // Markdown block, so its inline emphasis has to be flattened for the hero.
  const heroLead = layout?.heroLead
    ? plainText(layout.heroLead)
    : technology.content.summary;
  const image = technology.images[0];
  const options =
    technology.relatedService?.options.flatMap((option) => {
      const content = option.contents[0];
      return content
        ? [
            {
              key: option.key,
              type: option.type,
              bookable: option.bookable,
              group: content.group,
              name: content.name,
              summary: content.summary,
              durationLabel: content.durationLabel,
              priceLabel: content.priceLabel,
              offerRequiresAccount: option.offerRequiresAccount,
              image: option.image,
              imageAlt: content.imageAlt,
              imageFocalX: option.imageFocalX,
              imageFocalY: option.imageFocalY,
            },
          ]
        : [];
    }) ?? [];
  const canonical = absoluteLocalizedUrl(siteUrl(), path, locale);
  const bookable = Boolean(technology.relatedService?.bookable);
  const treatments = options.filter(
    (option) => option.bookable && option.type === "APPOINTMENT",
  );
  // Endospheres leads with its introductory offer; elsewhere the cheapest
  // treatment is the honest "from" price for the hero and the small-screen bar.
  const entryOption = isEndospheres
    ? (options.find((option) => option.key === "intro-75") ??
      options.find((option) => option.key.includes("intro")))
    : cheapest(treatments);
  const showTreatmentCards = isEditorial && !isEndospheres && bookable;
  const bookingAnchor = isEndospheres
    ? BOOKING_ANCHOR.endospheres
    : BOOKING_ANCHOR.treatments;
  const showBookingCta = isEditorial && bookable && Boolean(entryOption);

  return (
    <article className="bg-page">
      <JsonLd
        data={[
          webPageJsonLd({
            name: technology.content.name,
            description: technology.content.summary,
            url: canonical,
            image,
            locale,
          }),
          breadcrumbJsonLd([
            {
              name: "Mone Beauty Clinic",
              url: absoluteLocalizedUrl(siteUrl(), "/", locale),
            },
            { name: technology.content.name, url: canonical },
          ]),
        ]}
      />
      <section className="relative isolate overflow-hidden">
        {image ? (
          <>
            <Image
              src={image}
              alt={technology.content.imageAlt || technology.content.name}
              fill
              priority
              className="object-cover"
              sizes="100vw"
              style={{
                objectPosition: `${technology.imageFocalX}% ${technology.imageFocalY}%`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(34,30,27,.88)] via-[rgba(34,30,27,.42)] to-[rgba(34,30,27,.16)]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-alt" />
        )}
        <Container className="relative z-10 flex min-h-[clamp(420px,58vh,640px)] items-end py-[clamp(32px,5vw,68px)]">
          <div>
            {technology.content.specification ? (
              <Eyebrow
                tone={image ? "gold" : "accent"}
                tracking="wide"
                className="mb-[14px]"
              >
                {technology.content.specification}
              </Eyebrow>
            ) : null}
            <h1
              className={`max-w-[19ch] font-display text-[clamp(36px,5vw,68px)] leading-[1.02] font-medium ${image ? "text-cta-heading" : "text-ink"}`}
            >
              {technology.content.name}
            </h1>
            <p
              className={`mt-5 max-w-[62ch] font-sans text-[clamp(16px,1.35vw,19px)] leading-[1.68] font-normal ${image ? "text-cta-heading [text-shadow:0_1px_10px_rgba(58,42,28,.72)]" : "text-body"}`}
            >
              {heroLead}
            </p>
            {showBookingCta ? (
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                <a
                  href={`#${bookingAnchor}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] bg-accent px-7 font-sans text-label font-medium tracking-[.15em] text-page uppercase transition-[box-shadow,transform,filter] hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cta-heading motion-reduce:transform-none motion-reduce:transition-none"
                >
                  {endospheresHeroCta[locale]}
                  <CalendarBlank size={17} weight="thin" />
                </a>
                {entryOption?.priceLabel ? (
                  <p
                    className={`flex items-baseline gap-2 font-display text-[26px] leading-none font-medium ${image ? "text-cta-heading [text-shadow:0_1px_10px_rgba(58,42,28,.72)]" : "text-ink"}`}
                  >
                    {entryOption.priceLabel}
                    {entryOption.durationLabel &&
                    !entryOption.priceLabel.includes(
                      entryOption.durationLabel,
                    ) ? (
                      <span
                        className={`font-sans text-[13px] font-normal tracking-[.04em] ${image ? "text-cta-body" : "text-muted"}`}
                      >
                        {entryOption.durationLabel}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Container>
      </section>
      {isEndospheres && technology.relatedService?.bookable ? (
        <EndospheresBookingPanel
          serviceKey={technology.relatedService.slug}
          options={options}
          locale={locale}
        />
      ) : null}
      {showTreatmentCards && technology.relatedService ? (
        <TechnologyTreatmentCards
          serviceKey={technology.relatedService.slug}
          treatments={treatments}
          locale={locale}
        />
      ) : null}
      {showBookingCta && technology.relatedService ? (
        <TechnologyStickyBook
          label={endospheresHeroCta[locale]}
          price={entryOption?.priceLabel ?? null}
          locale={locale}
          serviceKey={technology.relatedService.slug}
          optionKey={entryOption?.key}
          anchorId={bookingAnchor}
        />
      ) : null}
      {isEditorial ? (
        <TechnologyEditorial
          body={technology.content.body}
          serviceKey={technology.relatedService?.slug}
          closingCtaLabel={bookable ? endospheresHeroCta[locale] : undefined}
        />
      ) : (
        <section className="py-[clamp(40px,6vw,76px)]">
          <Container>
            <div className="mx-auto max-w-[860px]">
              <Markdown variant="technology">
                {technology.content.body}
              </Markdown>
            </div>
          </Container>
        </section>
      )}
      {/* Technologies outside the editorial grammar keep the plain picker. */}
      {!isEditorial &&
      !isEndospheres &&
      technology.relatedService?.bookable &&
      options.length ? (
        <ServiceOptionSelector
          serviceKey={technology.relatedService.slug}
          options={options}
          locale={locale}
        />
      ) : null}
    </article>
  );
}
