"use client";

import { useState } from "react";
import { ArrowRight, CalendarBlank } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { ENDOSPHERES_PACKAGE_NOTE } from "@/content/endospheres";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import {
  normalizeEndospheresBookingOptions,
  type EndospheresPublicOption,
} from "@/lib/endospheres-booking-options";
import { cn } from "@/lib/cn";

const copy = {
  en: {
    eyebrow: "Book Endospheres Therapy®",
    title: "Choose your treatment",
    singles: "Single treatments",
    packages: "Treatment packages",
    duration: "Treatment duration",
    six: "6 sessions",
    twelve: "12 sessions",
    book: "Book now",
    offer: "Introductory offer",
    firstVisit:
      "The online reservation covers the first visit. Remaining sessions are arranged directly with the clinic.",
  },
  fi: {
    eyebrow: "Varaa Endospheres Therapy®",
    title: "Valitse hoito",
    singles: "Yksittäiset hoidot",
    packages: "Hoitopaketit",
    duration: "Hoidon kesto",
    six: "6 hoitokertaa",
    twelve: "12 hoitokertaa",
    book: "Varaa nyt",
    offer: "Tutustumistarjous",
    firstVisit:
      "Verkkoajanvaraus koskee ensimmäistä käyntiä. Loput hoitokerrat sovitaan suoraan klinikan kanssa.",
  },
  ru: {
    eyebrow: "Запись на Endospheres Therapy®",
    title: "Выберите процедуру",
    singles: "Разовые процедуры",
    packages: "Пакеты процедур",
    duration: "Продолжительность",
    six: "6 сеансов",
    twelve: "12 сеансов",
    book: "Записаться",
    offer: "Знакомство с процедурой",
    firstVisit:
      "Онлайн-запись оформляется на первое посещение. Остальные сеансы согласуются напрямую с клиникой.",
  },
} as const;

/**
 * Splits the clinic's duration guidance into its opening sentence and the rest.
 *
 * The first sentence names the areas the appointment covers, which is what a
 * reader is actually choosing between, so it leads the card. Only the 75 minute
 * protocol carries a second sentence. No wording changes.
 */
function splitGuidance(summary: string | undefined) {
  if (!summary) return { lead: null, rest: null };
  const at = summary.indexOf(". ");
  if (at < 0) return { lead: summary.trim(), rest: null };
  return {
    lead: summary.slice(0, at + 1).trim(),
    rest: summary.slice(at + 1).trim() || null,
  };
}

function BookingLink({
  serviceKey,
  option,
  label,
  compact = false,
  className,
}: {
  serviceKey: string;
  option: EndospheresPublicOption;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={{
        pathname: PUBLIC_PATHS.booking,
        query: { service: serviceKey, option: option.key },
      }}
      className={cn(
        "relative z-10 inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] bg-accent font-sans text-meta font-medium tracking-[.12em] text-page uppercase transition-[box-shadow,transform,filter] hover:-translate-y-px hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent motion-reduce:transform-none motion-reduce:transition-none",
        compact ? "px-4" : "px-5",
        className,
      )}
    >
      {label}
      {compact ? (
        <ArrowRight size={16} weight="thin" />
      ) : (
        <CalendarBlank size={17} weight="thin" />
      )}
      <span className="sr-only">: {option.name}</span>
    </Link>
  );
}

export function EndospheresBookingPanel({
  serviceKey,
  options,
  locale,
}: {
  serviceKey: string;
  options: EndospheresPublicOption[];
  locale: Locale;
}) {
  const [tab, setTab] = useState<"singles" | "packages">("singles");
  const { singles, packages } = normalizeEndospheresBookingOptions(options);
  const t = copy[locale];
  const featuredSingle = singles.find((option) => option.key.includes("intro"));
  const regularSingles = singles.filter(
    (option) => option.key !== featuredSingle?.key,
  );
  // The introductory offer is the 75 min protocol at a first-visit price, so
  // showing the standing price beside it is what makes the offer legible.
  const offerRegularPrice = featuredSingle
    ? (singles.find((option) => option.key === "75")?.priceLabel ?? null)
    : null;

  function moveTab(event: React.KeyboardEvent<HTMLButtonElement>) {
    const next =
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp" ||
      event.key === "Home"
        ? "singles"
        : event.key === "ArrowRight" ||
            event.key === "ArrowDown" ||
            event.key === "End"
          ? "packages"
          : null;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    document.getElementById(`endospheres-tab-${next}`)?.focus();
  }

  if (!singles.length && !packages.length) return null;

  return (
    <section
      id="endospheres-booking"
      className="scroll-mt-20 border-b border-line-hair bg-alt py-[clamp(44px,7vw,82px)]"
      aria-labelledby="endospheres-booking-heading"
    >
      <div className="mx-auto max-w-280 px-[clamp(20px,4vw,40px)]">
        <div className="grid items-end gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="font-sans text-meta font-medium tracking-[.15em] text-accent uppercase">
              {t.eyebrow}
            </p>
            <h2
              id="endospheres-booking-heading"
              className="mt-3 font-display text-[clamp(34px,4.8vw,54px)] leading-[1.04] font-medium text-ink"
            >
              {t.title}
            </h2>
          </div>
          <div
            role="tablist"
            aria-label={t.title}
            className="grid grid-cols-2 rounded-[6px] border border-line-card bg-card p-1"
          >
            {(
              [
                ["singles", t.singles],
                ["packages", t.packages],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                id={`endospheres-tab-${value}`}
                type="button"
                role="tab"
                aria-selected={tab === value}
                aria-controls={`endospheres-panel-${value}`}
                onClick={() => setTab(value)}
                onKeyDown={moveTab}
                tabIndex={tab === value ? 0 : -1}
                className={cn(
                  "min-h-11 rounded-[4px] px-4 font-sans text-[13px] font-medium tracking-[.08em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none",
                  tab === value
                    ? "bg-cta text-cta-heading shadow-(--shadow-card-soft)"
                    : "text-body hover:bg-page hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          id="endospheres-panel-singles"
          role="tabpanel"
          aria-labelledby="endospheres-tab-singles"
          hidden={tab !== "singles"}
          className="mt-8"
        >
          {featuredSingle ? (
            <article className="grid gap-5 rounded-(--radius) border border-accent bg-page p-[clamp(22px,4vw,36px)] shadow-(--shadow-card-soft) md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <p className="font-sans text-meta font-medium tracking-[.12em] text-accent uppercase">
                  {t.offer}
                </p>
                <h3 className="mt-3 max-w-[26ch] font-display text-[clamp(27px,3.2vw,38px)] leading-[1.06] font-medium text-ink">
                  {featuredSingle.name}
                </h3>
                {featuredSingle.summary ? (
                  <p className="mt-4 max-w-[58ch] font-sans text-[clamp(15px,1.02vw,17px)] leading-[1.7] text-body">
                    {featuredSingle.summary}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-6 md:justify-end">
                <div className="md:text-right">
                  <p className="font-sans text-label tracking-[.04em] text-muted">
                    {featuredSingle.durationLabel}
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-2.5 font-display text-[40px] leading-none font-medium text-ink md:justify-end">
                    {featuredSingle.priceLabel}
                    {offerRegularPrice ? (
                      <span className="font-sans text-[14px] font-normal text-muted line-through">
                        {offerRegularPrice}
                      </span>
                    ) : null}
                  </p>
                </div>
                <BookingLink
                  serviceKey={serviceKey}
                  option={featuredSingle}
                  label={t.book}
                />
              </div>
            </article>
          ) : null}

          <div className="mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {regularSingles.map((option) => {
              const { lead, rest } = splitGuidance(option.summary);
              return (
                <article
                  key={option.key}
                  className="flex flex-col rounded-(--radius) border border-line-card bg-card p-6 shadow-(--shadow-card-soft) transition-[border-color,box-shadow] hover:border-line-card-hover hover:shadow-(--shadow-card) motion-reduce:transition-none"
                >
                  {/* Duration and price are the two comparable figures, so
                      they read as one line before the areas covered. */}
                  <div className="flex items-baseline justify-between gap-3 font-sans text-label font-medium tracking-[.14em] text-accent uppercase">
                    <span>{option.durationLabel}</span>
                    <span>{option.priceLabel}</span>
                  </div>
                  <h3 className="mt-3 font-display text-[clamp(21px,1.9vw,26px)] leading-[1.28] font-medium text-ink">
                    {lead ?? option.name}
                  </h3>
                  {rest ? (
                    <p className="mt-3 font-sans text-[clamp(15px,1.02vw,17px)] leading-[1.65] text-body">
                      {rest}
                    </p>
                  ) : null}
                  <div className="mt-auto border-t border-line-hair pt-5">
                    <BookingLink
                      serviceKey={serviceKey}
                      option={option}
                      label={t.book}
                      compact
                      className="w-full"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div
          id="endospheres-panel-packages"
          role="tabpanel"
          aria-labelledby="endospheres-tab-packages"
          hidden={tab !== "packages"}
          className="mt-8"
        >
          <p className="mb-5 max-w-[72ch] font-sans text-[clamp(15px,1.02vw,17px)] leading-[1.7] text-body">
            {ENDOSPHERES_PACKAGE_NOTE[locale]}
          </p>
          <div className="hidden overflow-hidden rounded-(--radius) border border-line-card bg-card shadow-(--shadow-card-soft) md:block">
            <div className="grid grid-cols-[.7fr_1fr_1fr] border-b border-line-card bg-page font-sans text-label font-medium tracking-[.12em] text-muted uppercase">
              <div className="p-4">{t.duration}</div>
              <div className="border-l border-line-card p-4">{t.six}</div>
              <div className="border-l border-line-card p-4">{t.twelve}</div>
            </div>
            {packages.map((row) => (
              <div
                key={row.duration}
                className="grid grid-cols-[.7fr_1fr_1fr] border-b border-line-hair last:border-b-0"
              >
                <div className="flex items-center p-5 font-display text-[28px] font-medium text-ink">
                  {row.duration} {locale === "ru" ? "мин" : "min"}
                </div>
                {[row.six, row.twelve].map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-4 border-l border-line-card p-5"
                  >
                    {option ? (
                      <>
                        <span className="font-display text-[28px] font-medium text-ink">
                          {option.priceLabel}
                        </span>
                        <BookingLink
                          serviceKey={serviceKey}
                          option={option}
                          label={t.book}
                          compact
                        />
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:hidden">
            {packages.map((row) => (
              <article
                key={row.duration}
                className="rounded-(--radius) border border-line-card bg-card p-5 shadow-(--shadow-card-soft)"
              >
                <h3 className="font-display text-[28px] font-medium text-ink">
                  {row.duration} {locale === "ru" ? "мин" : "min"}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      [t.six, row.six],
                      [t.twelve, row.twelve],
                    ] as const
                  ).map(([label, option]) =>
                    option ? (
                      <div
                        key={label}
                        className="rounded-[8px] border border-line-hair bg-page p-4"
                      >
                        <p className="font-sans text-label text-body">
                          {label}
                        </p>
                        <p className="mt-1 font-display text-[28px] font-medium text-ink">
                          {option.priceLabel}
                        </p>
                        <div className="mt-3">
                          <BookingLink
                            serviceKey={serviceKey}
                            option={option}
                            label={t.book}
                            compact
                          />
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-5 max-w-[72ch] font-sans text-[clamp(15px,1.02vw,17px)] leading-[1.7] text-body">
            {t.firstVisit}
          </p>
        </div>
      </div>
    </section>
  );
}
