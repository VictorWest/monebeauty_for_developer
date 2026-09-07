"use client";

import { useEffect } from "react";
import {
  COOKIE_CONSENT_EVENT,
  readCookieConsent,
} from "@/components/privacy/CookieConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function Analytics() {
  useEffect(() => {
    const analyticsId = process.env.NEXT_PUBLIC_GA_ID;
    if (!analyticsId) return;
    const id = analyticsId;

    function disable() {
      window.gtag?.("consent", "update", {
        analytics_storage: "denied",
      });
    }

    function load() {
      if (readCookieConsent() !== "accepted") {
        disable();
        return;
      }
      window.dataLayer = window.dataLayer || [];
      window.gtag ??= function gtag(...args: unknown[]) {
        window.dataLayer?.push(args);
      };
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      });
      if (document.querySelector(`script[data-ga-id="${id}"]`)) return;

      window.gtag("js", new Date());
      window.gtag("config", id, { anonymize_ip: true });

      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      script.dataset.gaId = id;
      document.head.appendChild(script);
    }

    load();
    const listener = (event: Event) => {
      const value = (event as CustomEvent<"accepted" | "declined">).detail;
      if (value === "accepted") load();
      else disable();
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, listener);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, listener);
  }, []);

  return null;
}
