"use client";

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import type { Locale } from "@/i18n/routing";
import type { TechnologyChapter } from "@/lib/technology-layout";
import { plainText, sourceHeadingText } from "@/lib/technology-layout";
import { cn } from "@/lib/cn";

/**
 * The clinic's own pill wording for English; other locales fall back to the
 * chapter's own heading ("Indications" / "Contraindications") since no
 * translated pill copy was supplied.
 */
const PILL_LABEL: Partial<Record<Locale, { indications: string; contraindications: string }>> = {
  en: {
    indications: "Who It's For (Indications)",
    contraindications: "Important Safety Guidelines (Contraindications)",
  },
};

/** English-only, like the pill wording above: no translated copy was supplied. */
const SECTION_TITLE: Partial<Record<Locale, string>> = {
  en: "Who Is This For?",
};

function listItems(chapter: TechnologyChapter) {
  return chapter.body.map((block) => plainText(block.replace(/^[-*+]\s+/u, "")));
}

export function IndicationsContraindicationsTabs({
  indications,
  contraindications,
  locale,
}: {
  indications: TechnologyChapter;
  contraindications: TechnologyChapter;
  locale: Locale;
}) {
  const [tab, setTab] = useState<"indications" | "contraindications">("indications");
  const labels = PILL_LABEL[locale] ?? {
    indications: sourceHeadingText(indications.heading),
    contraindications: sourceHeadingText(contraindications.heading),
  };
  const active = tab === "indications" ? indications : contraindications;
  const sectionTitle = SECTION_TITLE[locale];

  return (
    <div className="mx-auto max-w-280">
      {sectionTitle ? (
        <h2 className="mb-6 text-center font-display text-[clamp(28px,3.4vw,40px)] leading-[1.1] font-medium text-ink">
          {sectionTitle}
        </h2>
      ) : null}
      <div
        role="tablist"
        className="inline-flex w-full flex-col gap-1 rounded-full border border-line-hair bg-alt p-1 sm:flex-row sm:gap-0"
      >
        {(
          [
            ["indications", labels.indications],
            ["contraindications", labels.contraindications],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 flex-1 rounded-full px-5 font-sans text-[clamp(14px,1vw,15px)] leading-tight font-medium transition-colors",
              tab === key
                ? "bg-page text-ink shadow-(--shadow-card-soft)"
                : "text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="mt-5 rounded-(--radius) border border-line-card bg-alt p-[clamp(24px,4vw,40px)] shadow-(--shadow-card-soft)"
      >
        <h3 className="font-display text-[clamp(22px,2.4vw,28px)] leading-[1.15] font-medium text-ink">
          {sourceHeadingText(active.heading)}
        </h3>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {listItems(active).map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Sparkle
                size={16}
                weight="fill"
                className="mt-1 shrink-0 text-accent"
                aria-hidden
              />
              <span className="font-sans text-[clamp(15px,1.02vw,17px)] leading-[1.6] text-body">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
