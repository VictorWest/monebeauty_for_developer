"use client";

import { useEffect, useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { cn } from "@/lib/cn";

/**
 * Small-screen booking bar for a technology page.
 *
 * These pages run to roughly eight screens on a phone and their only booking
 * control sits near the top, so a reader deep in the treatment copy has no way
 * to act without scrolling back. The bar appears once the picker has scrolled
 * out of view and links straight into it.
 */
export function TechnologyStickyBook({
  label,
  price,
  locale,
  serviceKey,
  optionKey,
  anchorId,
}: {
  label: string;
  price: string | null;
  locale: Locale;
  serviceKey: string;
  optionKey?: string;
  anchorId: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const panel = document.getElementById(anchorId);
      // Show the bar only once the picker itself has scrolled out of reach, so
      // it never competes with the controls it duplicates.
      const passed = panel
        ? panel.getBoundingClientRect().bottom < 0
        : window.scrollY > window.innerHeight;
      setVisible(passed);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [anchorId]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line-card bg-page/95 backdrop-blur-sm transition-[opacity,transform] duration-300 ease-out nav:hidden motion-reduce:transition-none",
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0 motion-reduce:hidden",
        )}
      >
        <div className="flex items-center gap-4 px-[clamp(16px,5vw,28px)] py-3 pr-20 pb-[max(12px,env(safe-area-inset-bottom))]">
          {price ? (
            <p className="font-display text-[26px] leading-none font-medium text-ink">
              {price}
            </p>
          ) : null}
          <Link
            href={{
              pathname: PUBLIC_PATHS.booking,
              query: optionKey
                ? { service: serviceKey, option: optionKey }
                : { service: serviceKey },
            }}
            locale={locale}
            className="ml-auto inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[4px] bg-accent px-5 font-sans text-meta font-medium tracking-[.14em] text-page uppercase transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent motion-reduce:transition-none"
          >
            {label}
            <CalendarBlank size={16} weight="thin" />
          </Link>
        </div>
      </div>
    </>
  );
}
