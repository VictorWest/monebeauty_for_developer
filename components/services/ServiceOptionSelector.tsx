"use client";

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

export type PublicServiceOption = {
  key: string;
  type: "APPOINTMENT" | "COURSE" | "INFORMATIONAL_PACKAGE";
  bookable: boolean;
  group: string | null;
  name: string;
  summary?: string;
  durationLabel: string | null;
  priceLabel: string | null;
  image?: string | null;
  imageAlt?: string | null;
  imageFocalX?: number;
  imageFocalY?: number;
};

const copy = {
  en: {
    title: "Choose a treatment",
    packages: "Package pricing",
    book: "Book selected treatment",
    choose: "Select a treatment before continuing",
    info: "Contact the clinic or use general booking for package scheduling.",
    contact: "Continue to general booking",
  },
  fi: {
    title: "Valitse hoito",
    packages: "Pakettihinnat",
    book: "Varaa valittu hoito",
    choose: "Valitse hoito ennen jatkamista",
    info: "Ota yhteyttä klinikkaan tai käytä yleistä ajanvarausta paketin aikataulutukseen.",
    contact: "Siirry yleiseen ajanvaraukseen",
  },
  ru: {
    title: "Выберите процедуру",
    packages: "Цены на пакеты",
    book: "Записаться на выбранную процедуру",
    choose: "Перед продолжением выберите процедуру",
    info: "Для планирования пакета свяжитесь с клиникой или перейдите к общей записи.",
    contact: "Перейти к общей записи",
  },
} as const;

export function ServiceOptionSelector({
  serviceKey,
  options,
  locale,
}: {
  serviceKey: string;
  options: PublicServiceOption[];
  locale: Locale;
}) {
  const bookable = options.filter(
    (item) =>
      (item.type === "APPOINTMENT" || item.type === "COURSE") && item.bookable,
  );
  const packages = options.filter(
    (item) => item.type === "INFORMATIONAL_PACKAGE",
  );
  const [selected, setSelected] = useState<string | null>(
    bookable.length === 1 ? bookable[0].key : null,
  );
  const t = copy[locale];

  return (
    <section
      className="border-t border-line-hair bg-alt py-[clamp(48px,7vw,88px)]"
      aria-labelledby="treatment-options-heading"
    >
      <div className="mx-auto max-w-215 px-[clamp(20px,4vw,40px)]">
        {bookable.length ? (
          <>
            <h2
              id="treatment-options-heading"
              className="font-display text-[clamp(30px,4vw,44px)] font-medium text-ink"
            >
              {t.title}
            </h2>
            <fieldset
              className="mt-6 grid gap-3"
              aria-describedby={!selected ? "option-help" : undefined}
            >
              <legend className="sr-only">{t.title}</legend>
              {bookable.map((option) => (
                <label
                  key={option.key}
                  className={cn(
                    "flex min-h-16 cursor-pointer items-start gap-4 rounded-(--radius) border bg-card p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
                    selected === option.key
                      ? "border-accent"
                      : "border-line-card hover:border-line-card-hover",
                  )}
                >
                  <input
                    type="radio"
                    name="service-option"
                    value={option.key}
                    checked={selected === option.key}
                    onChange={() => setSelected(option.key)}
                    className="mt-1 h-5 w-5 accent-(--color-accent)"
                  />
                  <span className="min-w-0 flex-1">
                    {option.group ? (
                      <span className="block font-sans text-meta tracking-[.12em] text-accent uppercase">
                        {option.group}
                      </span>
                    ) : null}
                    <span className="block font-sans text-copy font-medium text-ink">
                      {option.name}
                    </span>
                  </span>
                  <span className="text-right font-sans text-[14px] leading-6 text-body">
                    {option.durationLabel ? (
                      <span className="block">{option.durationLabel}</span>
                    ) : null}
                    {option.priceLabel ? (
                      <span className="block font-medium text-ink">
                        {option.priceLabel}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>
            {!selected && bookable.length > 1 ? (
              <p
                id="option-help"
                className="mt-3 font-sans text-[14px] text-muted"
              >
                {t.choose}
              </p>
            ) : null}
            <div className="mt-6">
              {selected ? (
                <Button
                  href={{
                    pathname: PUBLIC_PATHS.booking,
                    query: { service: serviceKey, option: selected },
                  }}
                  iconRight={ArrowRight}
                >
                  {t.book}
                </Button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="min-h-11 rounded-[4px] bg-accent px-5 font-sans text-meta font-medium tracking-[.12em] text-page uppercase opacity-45"
                >
                  {t.book}
                </button>
              )}
            </div>
          </>
        ) : null}
        {packages.length ? (
          <div className={bookable.length ? "mt-12" : ""}>
            <h2 className="font-display text-[clamp(28px,3.5vw,38px)] font-medium text-ink">
              {t.packages}
            </h2>
            <div className="mt-5 divide-y divide-line-hair rounded-(--radius) border border-line-card bg-card">
              {packages.map((option) => (
                <div
                  key={option.key}
                  className="flex justify-between gap-5 p-4 font-sans text-copy"
                >
                  <span>{option.name}</span>
                  <span className="text-right font-medium text-ink">
                    {option.priceLabel}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 font-sans text-[14px] text-body">{t.info}</p>
            <Button
              href={PUBLIC_PATHS.booking}
              variant="textLink"
              iconRight={ArrowRight}
              className="mt-3"
            >
              {t.contact}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
