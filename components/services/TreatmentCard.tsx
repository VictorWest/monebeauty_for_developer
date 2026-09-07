"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export type TreatmentCardItem = {
  group: string | null;
  title: string;
  description: string;
  price: string;
};

export function TreatmentCard({
  item,
  index,
  image,
  bookingKey,
  bookLabel,
  seeMoreLabel,
  seeLessLabel,
}: {
  item: TreatmentCardItem;
  index: number;
  image: string | null;
  bookingKey: string;
  bookLabel: string;
  seeMoreLabel: string;
  seeLessLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = shouldClamp(item.description);

  return (
    <article
      className={cn(
        "group flex min-h-full flex-col overflow-hidden rounded-[var(--radius)] border border-line-card bg-card transition-all duration-300 hover:-translate-y-[6px] hover:border-line-card-hover hover:shadow-card",
        !expanded && image && "min-h-[590px]",
        !expanded && !image && "min-h-[380px]",
      )}
    >
      {image ? (
        <div className="relative h-[208px] shrink-0 overflow-hidden">
          <Image
            src={image}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 900px) 100vw, 33vw"
          />
          <span className="absolute top-[20px] left-[18px] font-display text-[26px] text-[rgba(58,42,28,.38)]">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col p-[22px_22px_26px]">
        {!image ? (
          <span className="mb-[12px] font-display text-[24px] text-[rgba(58,42,28,.38)]">
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : null}
        {item.group ? (
          <p className="mb-[10px] font-sans text-meta font-medium tracking-[.2em] text-accent uppercase">
            {item.group}
          </p>
        ) : null}
        <h2 className="font-display text-[24px] leading-[1.1] font-semibold text-ink">
          {item.title}
        </h2>
        <p className="mt-[14px] w-fit rounded-[4px] border border-line-card bg-alt px-[12px] py-[7px] font-sans text-[14px] font-medium text-ink">
          {item.price}
        </p>
        <div
          className={cn(
            "relative mt-[16px] min-h-0 flex-1 [&_h2]:text-[22px] [&_h3]:text-[20px] [&_img]:hidden [&_li]:text-compact [&_li]:leading-[1.65] [&_p]:mt-[10px] [&_p]:text-compact [&_p]:leading-[1.65] [&_ul]:gap-[6px]",
            canExpand && !expanded && "max-h-[132px] overflow-hidden",
          )}
        >
          <Markdown>{item.description}</Markdown>
          {canExpand && !expanded ? (
            <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-[44px] bg-gradient-to-t from-card to-transparent" />
          ) : null}
        </div>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-[12px] w-fit border-b border-line-underline pb-[3px] font-sans text-meta font-medium tracking-[.16em] text-accent uppercase transition-colors hover:border-accent"
          >
            {expanded ? seeLessLabel : seeMoreLabel}
          </button>
        ) : null}
        <div className="mt-[22px]">
          <Button
            href={{
              pathname: PUBLIC_PATHS.booking,
              query: { service: bookingKey, procedure: index + 1 },
            }}
            iconRight={ArrowRight}
            size="sm"
          >
            {bookLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

function shouldClamp(markdown: string) {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const structuralLines = markdown
    .split("\n")
    .filter((line) => line.trim().length > 0).length;
  return text.length > 190 || structuralLines > 5;
}
