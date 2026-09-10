import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Container } from "@/components/ui/Container";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { cn } from "@/lib/cn";

export type TechnologyTreatment = {
  key: string;
  name: string;
  summary?: string;
  group: string | null;
  durationLabel: string | null;
  priceLabel: string | null;
  image?: string | null;
  imageAlt?: string | null;
  imageFocalX?: number;
  imageFocalY?: number;
};

const copy = {
  en: { title: "Choose your treatment", book: "Book now" },
  fi: { title: "Valitse hoito", book: "Varaa nyt" },
  ru: { title: "Выберите процедуру", book: "Записаться" },
} as const;

/**
 * The bookable treatments for a technology page.
 *
 * These used to render as one radio fieldset: 36 rows for laser: showing a
 * name, a duration and a price. Every option already carries a localized
 * summary and its own photo; both were loaded and then dropped. Cards publish
 * them so the list can be read rather than scrolled past.
 */
export function TechnologyTreatmentCards({
  serviceKey,
  treatments,
  locale,
  anchorId = "technology-treatments",
}: {
  serviceKey: string;
  treatments: TechnologyTreatment[];
  locale: Locale;
  anchorId?: string;
}) {
  if (!treatments.length) return null;
  const t = copy[locale];
  // Every laser option shares one group label, so it titles the section rather
  // than splitting it. Real body-area grouping needs labels from the clinic.
  const groupLabel = treatments[0].group;
  // A single photo repeated down the whole list reads as a layout bug, so
  // imagery is only used when the options genuinely differ.
  const images = new Set(treatments.map((item) => item.image).filter(Boolean));
  const showImages = images.size > 1;

  return (
    <section
      id={anchorId}
      className="scroll-mt-20 border-b border-line-hair bg-alt py-[clamp(44px,7vw,82px)]"
      aria-labelledby="technology-treatments-heading"
    >
      <Container>
        <div className="mx-auto max-w-280">
          {groupLabel ? (
            <p className="font-sans text-meta font-medium tracking-[.15em] text-accent uppercase">
              {groupLabel}
            </p>
          ) : null}
          <h2
            id="technology-treatments-heading"
            className="mt-3 font-display text-[clamp(34px,4.8vw,54px)] leading-[1.04] font-medium text-ink"
          >
            {t.title}
          </h2>

          <div className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {treatments.map((item) => (
              <article
                key={item.key}
                className="flex flex-col overflow-hidden rounded-(--radius) border border-line-card bg-card shadow-(--shadow-card-soft) transition-[border-color,box-shadow] hover:border-line-card-hover hover:shadow-(--shadow-card) motion-reduce:transition-none"
              >
                {showImages && item.image ? (
                  <div className="relative aspect-[16/10] bg-alt">
                    <Image
                      src={item.image}
                      alt={item.imageAlt ?? ""}
                      fill
                      className="object-cover"
                      sizes="(min-width:1024px) 400px, (min-width:640px) 46vw, 90vw"
                      style={{
                        objectPosition: `${item.imageFocalX ?? 50}% ${item.imageFocalY ?? 50}%`,
                      }}
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-baseline justify-between gap-3 font-sans text-label font-medium tracking-[.14em] text-accent uppercase">
                    {/* Laser and RF price labels already read "285 € / 70 min",
                        so pairing them with the duration repeated it twice. */}
                    {item.durationLabel &&
                    !item.priceLabel?.includes(item.durationLabel) ? (
                      <span>{item.durationLabel}</span>
                    ) : (
                      <span />
                    )}
                    {item.priceLabel ? <span>{item.priceLabel}</span> : null}
                  </div>
                  <h3 className="mt-3 font-display text-[clamp(21px,1.9vw,26px)] leading-[1.25] font-medium text-ink">
                    {item.name}
                  </h3>
                  {item.summary ? (
                    <p className="mt-3 font-sans text-[clamp(15px,1.02vw,17px)] leading-[1.65] text-body">
                      {item.summary}
                    </p>
                  ) : null}
                  <div className="mt-auto border-t border-line-hair pt-5">
                    <Link
                      href={{
                        pathname: PUBLIC_PATHS.booking,
                        query: { service: serviceKey, option: item.key },
                      }}
                      className={cn(
                        "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[4px] bg-accent px-4 font-sans text-meta font-medium tracking-[.12em] text-page uppercase",
                        "transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent motion-reduce:transition-none",
                      )}
                    >
                      {t.book}
                      <ArrowRight size={16} weight="thin" />
                      <span className="sr-only">: {item.name}</span>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
