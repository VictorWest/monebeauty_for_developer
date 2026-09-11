"use client";

import type { useTranslations } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react";
import { ButtonAction } from "@/components/ui/Button";

/**
 * Sticky summary bar shown while a client is building a multi-procedure
 * cart (e.g. several laser zones for one visit). Duration only — no price
 * total, since prices are free-text display labels, not a number the wizard
 * can safely sum (see the "Any Specialist"/multi-procedure delivery plan).
 */
export function BookingCartBar({
  count,
  totalDurationMin,
  onBook,
  t,
}: {
  count: number;
  totalDurationMin: number;
  onBook: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="sticky bottom-4 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-line-card bg-card p-4 shadow-card">
      <div className="font-sans text-[14px] text-ink">
        <span className="font-medium">{t("cart.count", { count })}</span>
        <span className="text-muted">
          {" "}
          · {t("context.duration", { minutes: totalDurationMin })}
        </span>
      </div>
      <ButtonAction
        type="button"
        size="sm"
        iconRight={ArrowRight}
        onClick={onBook}
      >
        {t("cart.book", { count })}
      </ButtonAction>
    </div>
  );
}
