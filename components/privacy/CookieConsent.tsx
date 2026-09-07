"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "monebeauty.cookie-consent.v1";
const COOKIE_KEY = "monebeauty_cookie_consent";
export const COOKIE_CONSENT_EVENT = "monebeauty-cookie-consent";

type ConsentValue = "accepted" | "declined";

export function readCookieConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  let value: string | null = null;
  try {
    value = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Privacy modes can block localStorage; the first-party cookie remains usable.
  }
  if (value !== "accepted" && value !== "declined") {
    value =
      document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${COOKIE_KEY}=`))
        ?.split("=")[1] ?? null;
  }
  return value === "accepted" || value === "declined" ? value : null;
}

function writeCookieConsent(value: ConsentValue) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Cookie persistence below is the fallback.
  }
  document.cookie = `${COOKIE_KEY}=${value}; Max-Age=31536000; Path=/; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }),
  );
}

export function CookieConsent() {
  const t = useTranslations("CookieConsent");
  const consent = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
      window.addEventListener("storage", onStoreChange);
      return () => {
        window.removeEventListener(COOKIE_CONSENT_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    readCookieConsent,
    () => null,
  );

  function choose(value: ConsentValue) {
    writeCookieConsent(value);
  }

  if (consent !== null) return null;

  return (
    <section
      aria-label={t("title")}
      className="fixed right-[14px] bottom-[90px] left-[14px] z-[70] mx-auto max-w-[760px] rounded-[var(--radius)] border border-line-card bg-page p-[18px] shadow-[var(--shadow-bubble)] sm:right-[22px] sm:left-auto sm:w-[420px]"
    >
      <h2 className="font-display text-[22px] font-medium text-ink">
        {t("title")}
      </h2>
      <p className="mt-[8px] font-sans text-compact leading-[1.6] text-body">
        {t("body")}
      </p>
      <div className="mt-[14px] flex flex-wrap gap-[10px]">
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="min-h-[44px] rounded-[4px] bg-accent px-[16px] font-sans text-meta font-medium tracking-[.14em] text-page uppercase"
        >
          {t("accept")}
        </button>
        <button
          type="button"
          onClick={() => choose("declined")}
          className="min-h-[44px] rounded-[4px] border border-line-btn px-[16px] font-sans text-meta font-medium tracking-[.14em] text-ink uppercase"
        >
          {t("decline")}
        </button>
      </div>
    </section>
  );
}
