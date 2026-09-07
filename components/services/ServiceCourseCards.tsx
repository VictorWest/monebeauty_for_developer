import { ArrowRight, CalendarBlank } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { SERVICE_PUBLIC_PATHS, treatmentOptionPath } from "@/lib/public-routes";
import type { Locale } from "@/i18n/routing";
import type { PublicServiceOption } from "@/components/services/ServiceOptionSelector";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";
import { Markdown } from "@/components/Markdown";
import { groupTreatmentOptions } from "@/lib/treatment-groups";

const copy = {
  en: {
    title: "Treatments and courses",
    details: "View details",
    book: "Book now",
    duration: "Duration",
    price: "Price",
    other: "Other treatments",
  },
  fi: {
    title: "Hoidot ja hoitosarjat",
    details: "Katso tiedot",
    book: "Varaa nyt",
    duration: "Kesto",
    price: "Hinta",
    other: "Muut hoidot",
  },
  ru: {
    title: "Процедуры и курсы",
    details: "Подробнее",
    book: "Записаться",
    duration: "Продолжительность",
    price: "Цена",
    other: "Другие процедуры",
  },
} as const;

function categoryPrice(price: string | null, duration: string | null) {
  if (!price || !duration) return price;
  const escaped = duration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return price
    .replace(new RegExp(`\\s*[/·|]\\s*${escaped}\\s*$`, "iu"), "")
    .trim();
}

export function ServiceCourseCards({
  serviceKey,
  options,
  locale,
}: {
  serviceKey: string;
  options: PublicServiceOption[];
  locale: Locale;
}) {
  const t = copy[locale];
  const servicePath =
    SERVICE_PUBLIC_PATHS[serviceKey as keyof typeof SERVICE_PUBLIC_PATHS];
  if (!servicePath) return null;

  const groups = groupTreatmentOptions(options, t.other);

  return (
    <section
      className="border-y border-line-hair bg-alt py-[clamp(48px,7vw,88px)]"
      aria-labelledby="service-course-cards-heading"
    >
      <Container>
        <div className="mx-auto max-w-280">
          <h2
            id="service-course-cards-heading"
            className="font-display text-[clamp(30px,4vw,44px)] font-medium text-ink"
          >
            {t.title}
          </h2>
          <div className="mt-8 space-y-[clamp(34px,5vw,56px)]">
            {groups.map(({ name: group, options: groupOptions }) => {
              const soleOption = groupOptions.length === 1;
              return (
                <section
                  key={group}
                  aria-labelledby={`group-${groupOptions[0].key}`}
                >
                  <h3
                    id={`group-${groupOptions[0].key}`}
                    className="font-sans text-meta font-medium tracking-[.14em] text-accent uppercase"
                  >
                    {group}
                  </h3>
                  <div
                    className={cn(
                      "mt-4 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
                      soleOption && "sm:grid-cols-1 xl:grid-cols-1",
                    )}
                  >
                    {groupOptions.map((option) => {
                      const detailPath = treatmentOptionPath(
                        servicePath,
                        option.key,
                      );
                      const price = categoryPrice(
                        option.priceLabel,
                        option.durationLabel,
                      );
                      return (
                        <article
                          key={option.key}
                          className={cn(
                            "group/card relative flex h-full min-h-90 flex-col rounded-(--radius) border border-line-card bg-card p-[clamp(20px,3vw,28px)] shadow-(--shadow-card-soft) transition-[background-color,box-shadow,transform] focus-within:shadow-(--shadow-card) hover:-translate-y-0.5 hover:bg-page hover:shadow-(--shadow-card) motion-reduce:transform-none motion-reduce:transition-none",
                            soleOption && "min-h-72",
                          )}
                        >
                          <h4 className="font-display text-[clamp(25px,3vw,32px)] leading-[1.08] font-medium text-ink">
                            {option.name}
                          </h4>
                          {option.summary ? (
                            <Markdown
                              variant="treatment-summary"
                              className="mt-4"
                            >
                              {option.summary}
                            </Markdown>
                          ) : null}

                          <div className="mt-auto pt-6">
                            <dl className="flex min-w-0 flex-nowrap items-baseline justify-between gap-4 border-t border-line-hair pt-4 font-sans text-[14px] text-body">
                              {option.durationLabel ? (
                                <div className="min-w-0 whitespace-nowrap">
                                  <dt className="sr-only">{t.duration}</dt>
                                  <dd>{option.durationLabel}</dd>
                                </div>
                              ) : null}
                              {price ? (
                                <div className="min-w-0 text-right whitespace-nowrap">
                                  <dt className="sr-only">{t.price}</dt>
                                  <dd className="font-medium text-ink">
                                    {price}
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                              <span className="inline-flex min-h-11 items-center gap-2 border-b border-line-underline font-sans text-meta font-medium tracking-[.12em] text-accent uppercase group-hover/card:border-accent">
                                {t.details}
                                <ArrowRight size={16} weight="thin" />
                              </span>
                              {(option.type === "APPOINTMENT" ||
                                option.type === "COURSE") &&
                              option.bookable ? (
                                <Link
                                  href={{
                                    pathname: "/ajanvaraus",
                                    query: {
                                      service: serviceKey,
                                      option: option.key,
                                    },
                                  }}
                                  className="relative z-10 inline-flex min-h-11 items-center gap-2 rounded-[4px] bg-accent px-5 font-sans text-meta font-medium tracking-widest text-page uppercase transition-[box-shadow,transform,filter] hover:-translate-y-px hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent motion-reduce:transform-none motion-reduce:transition-none"
                                >
                                  {t.book}
                                  <CalendarBlank size={16} weight="thin" />
                                  <span className="sr-only">
                                    : {option.name}
                                  </span>
                                </Link>
                              ) : null}
                            </div>
                          </div>
                          <Link
                            href={detailPath}
                            aria-label={`${t.details}: ${option.name}`}
                            className="absolute inset-0 rounded-(--radius) focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
                          />
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
