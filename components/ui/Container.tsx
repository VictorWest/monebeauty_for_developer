import { cn } from "@/lib/cn";

/** Centered max-width content wrapper with the spec's fluid horizontal padding. */
export function Container({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "narrow";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-[clamp(20px,5vw,56px)]",
        width === "narrow" ? "max-w-[1100px]" : "max-w-[1280px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
