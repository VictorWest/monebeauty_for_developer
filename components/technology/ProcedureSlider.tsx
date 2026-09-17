"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import Image from "next/image";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/i18n/routing";
import type { TechnologyChapter } from "@/lib/technology-layout";
import { sourceHeadingText } from "@/lib/technology-layout";
import { cn } from "@/lib/cn";

const copy = {
  en: { prev: "Previous step", next: "Next step", goTo: "Go to step" },
  fi: { prev: "Edellinen vaihe", next: "Seuraava vaihe", goTo: "Siirry vaiheeseen" },
  ru: { prev: "Предыдущий шаг", next: "Следующий шаг", goTo: "Перейти к шагу" },
} as const satisfies Record<Locale, { prev: string; next: string; goTo: string }>;

/**
 * Renders the numbered technology chapters (the 4 treatment steps) one at a
 * time, at full width, instead of a stacked list or a row of small cards.
 *
 * A row of cards at this container's width fit all four side by side with no
 * overflow, so nothing ever scrolled and the four looked like a clumped,
 * repetitive grid rather than a sequence. One large slide per view forces
 * genuine paging on every screen size and gives each photo real size.
 */
export function ProcedureSlider({
  stages,
  images,
  bookingHref,
  bookingLabel,
  locale,
}: {
  stages: TechnologyChapter[];
  images: string[];
  bookingHref: ComponentProps<typeof Button>["href"];
  bookingLabel?: string;
  locale: Locale;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const t = copy[locale];

  function goTo(index: number) {
    const track = trackRef.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        setActive(Math.round(track.scrollLeft / width));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="mx-auto max-w-280">
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-[13px] font-medium tracking-[.2em] text-accent uppercase">
          {String(active + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t.prev}
            disabled={active === 0}
            onClick={() => goTo(active - 1)}
            className="flex size-10 items-center justify-center rounded-full border border-line-btn text-ink transition-colors hover:border-line-btn-hover hover:bg-btn-fill disabled:pointer-events-none disabled:opacity-30"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <button
            type="button"
            aria-label={t.next}
            disabled={active === stages.length - 1}
            onClick={() => goTo(active + 1)}
            className="flex size-10 items-center justify-center rounded-full border border-line-btn text-ink transition-colors hover:border-line-btn-hover hover:bg-btn-fill disabled:pointer-events-none disabled:opacity-30"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="mt-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stages.map((chapter, index) => (
          <article
            key={chapter.heading}
            className="grid w-full shrink-0 snap-center items-center gap-8 md:grid-cols-2 md:gap-14"
          >
            {images[index] ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-(--radius) bg-alt shadow-(--shadow-card-soft) md:aspect-[16/11]">
                <Image
                  src={images[index]}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(min-width:768px) 50vw, 100vw"
                  priority={index === 0}
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <h3 className="font-display text-[clamp(24px,2.6vw,32px)] leading-[1.15] font-medium text-ink">
                {sourceHeadingText(chapter.heading).replace(/^\d+[.)]?\s*/u, "")}
              </h3>
              <p className="mt-4 max-w-[52ch] font-sans text-[clamp(15px,1.05vw,17px)] leading-[1.65] text-body">
                {chapter.body.join(" ")}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {stages.map((chapter, index) => (
          <button
            key={chapter.heading}
            type="button"
            aria-label={`${t.goTo} ${index + 1}`}
            aria-current={index === active}
            onClick={() => goTo(index)}
            className={cn(
              "h-2 rounded-full transition-[width,background-color]",
              index === active ? "w-6 bg-accent" : "w-2 bg-line-card-hover",
            )}
          />
        ))}
      </div>

      {bookingLabel ? (
        <div className="mt-8 flex justify-center">
          <Button href={bookingHref} iconRight={CalendarBlank}>
            {bookingLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
