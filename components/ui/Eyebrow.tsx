import { cn } from "@/lib/cn";

/** Small uppercase tracked kicker label. `gold` variant for use on the dark CTA band. */
export function Eyebrow({
  children,
  className,
  tone = "accent",
  tracking = "normal",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "accent" | "gold";
  tracking?: "normal" | "wide";
}) {
  return (
    <p
      className={cn(
        "font-sans text-[12px] font-medium uppercase",
        tracking === "wide" ? "tracking-[.28em]" : "tracking-[.26em]",
        tone === "gold" ? "text-gold" : "text-accent",
        className,
      )}
    >
      {children}
    </p>
  );
}
