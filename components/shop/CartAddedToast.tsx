"use client";

import { useEffect, useRef } from "react";
import { CheckCircle, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PUBLIC_PATHS } from "@/lib/public-routes";

const DISMISS_AFTER_MS = 5_000;

export function CartAddedToast({
  noticeId,
  productName,
  onDismiss,
}: {
  noticeId: number;
  productName: string;
  onDismiss: () => void;
}) {
  const t = useTranslations("Cart");
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const remaining = useRef(DISMISS_AFTER_MS);

  function stopTimer() {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  }

  function pauseTimer() {
    if (timer.current === null) return;
    remaining.current = Math.max(
      0,
      remaining.current - (Date.now() - startedAt.current),
    );
    stopTimer();
  }

  function startTimer() {
    stopTimer();
    startedAt.current = Date.now();
    timer.current = window.setTimeout(onDismiss, remaining.current);
  }

  useEffect(() => {
    remaining.current = DISMISS_AFTER_MS;
    startTimer();
    return stopTimer;
    // A new notice must restart the full dismissal interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeId]);

  return (
    <aside
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocusCapture={pauseTimer}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) startTimer();
      }}
      className="fixed top-[78px] right-[14px] left-[14px] z-[70] flex animate-[cartToastIn_.2s_ease-out] items-center gap-[12px] rounded-[var(--radius)] border border-line-card bg-card p-[14px] shadow-[var(--shadow-bubble)] min-[1180px]:top-[94px] sm:left-auto sm:w-[min(430px,calc(100vw-44px))]"
    >
      <CheckCircle
        size={24}
        weight="thin"
        aria-hidden="true"
        className="shrink-0 text-accent"
      />
      <p
        role="status"
        aria-live="polite"
        className="min-w-0 flex-1 font-sans text-[14px] leading-[1.4] text-ink"
      >
        {t("addedToBasket", { name: productName })}
      </p>
      <Link
        href={PUBLIC_PATHS.basket}
        onClick={onDismiss}
        className="shrink-0 border-b border-line-underline pb-[2px] font-sans text-[11px] font-medium tracking-[.1em] text-accent uppercase transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("viewBasket")}
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismiss")}
        className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-[4px] text-muted transition-colors hover:bg-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <X size={18} weight="thin" aria-hidden="true" />
      </button>
    </aside>
  );
}
