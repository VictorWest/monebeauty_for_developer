import Image from "next/image";
import { Image as ImageIcon, ArrowDown } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

const LIGHT_GRADIENT =
  "repeating-linear-gradient(135deg,rgba(255,255,255,.45) 0 1px,transparent 1px 17px),linear-gradient(155deg,#E7DBC8,#D6C5AB)";
const DARK_GRADIENT =
  "repeating-linear-gradient(135deg,rgba(255,255,255,.06) 0 1px,transparent 1px 17px),linear-gradient(155deg,#4A4338,#2E2A23)";

/**
 * Media slot. Renders (in priority order): a looping muted `videoSrc`, a real
 * `src` image, else the beige pinstripe placeholder. Layout stays final; only
 * the imagery is swapped.
 */
export function ImageSlot({
  caption,
  src,
  videoSrc,
  poster,
  alt,
  minHeight = 480,
  tone = "light",
  scrollHint = false,
  rounded = true,
  className,
  priority = false,
  imageStyle,
}: {
  caption?: string;
  src?: string | null;
  videoSrc?: string | null;
  poster?: string | null;
  alt?: string;
  minHeight?: number;
  tone?: "light" | "dark";
  scrollHint?: boolean;
  rounded?: boolean;
  className?: string;
  priority?: boolean;
  imageStyle?: CSSProperties;
}) {
  const hasMedia = Boolean(videoSrc || src);
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        rounded && "rounded-[var(--radius)]",
        className,
      )}
      style={{
        minHeight,
        backgroundImage: hasMedia
          ? undefined
          : tone === "dark"
            ? DARK_GRADIENT
            : LIGHT_GRADIENT,
      }}
    >
      {videoSrc ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={poster ?? undefined}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : src ? (
        <Image
          src={src}
          alt={alt ?? caption ?? ""}
          fill
          priority={priority}
          className="object-cover"
          sizes="(max-width: 900px) 100vw, 50vw"
          style={imageStyle}
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-[9px]",
            tone === "dark" ? "text-[#A99C86]" : "text-[#A1907A]",
          )}
        >
          <ImageIcon size={30} weight="thin" />
          {caption ? (
            <span className="font-mono text-[11px] tracking-[.2em] uppercase">
              {caption}
            </span>
          ) : null}
        </div>
      )}

      {scrollHint ? (
        <div className="absolute right-[22px] bottom-[22px] grid h-[48px] w-[48px] place-items-center rounded-full bg-[rgba(251,248,243,.9)] text-accent shadow-[var(--shadow-scroll)]">
          <ArrowDown size={20} weight="thin" />
        </div>
      ) : null}
    </div>
  );
}
