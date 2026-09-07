import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type IconType = React.ComponentType<{
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold";
  className?: string;
}>;

type Variant = "primary" | "outline" | "primaryOnDark" | "textLink";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-[9px] font-sans font-medium whitespace-nowrap uppercase transition-all duration-200 ease-out";

const variants: Record<Variant, string> = {
  primary:
    "rounded-[4px] bg-accent text-page hover:-translate-y-[2px] hover:[background:color-mix(in_srgb,var(--accent)_86%,#000)]",
  outline:
    "rounded-[4px] border border-line-btn bg-transparent text-ink hover:border-line-btn-hover hover:bg-btn-fill",
  primaryOnDark:
    "rounded-[4px] bg-accent text-page hover:-translate-y-[2px] hover:[background:color-mix(in_srgb,var(--accent)_82%,#fff)]",
  textLink:
    "gap-[7px] border-b border-line-underline pb-[3px] text-accent hover:[border-color:var(--accent)]",
};

const sizes: Record<Size, string> = {
  md: "px-[30px] py-[16px] text-label tracking-[.17em]",
  sm: "px-[22px] py-[12px] text-meta tracking-[.16em]",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  iconRight?: IconType;
  className?: string;
  children: React.ReactNode;
};

function inner(iconRight: IconType | undefined, children: React.ReactNode) {
  const Icon = iconRight;
  return (
    <>
      {children}
      {Icon ? <Icon size={16} weight="thin" className="shrink-0" /> : null}
    </>
  );
}

function classes(variant: Variant, size: Size, className?: string) {
  return cn(
    base,
    variants[variant],
    variant !== "textLink" && sizes[size],
    className,
  );
}

/** Internal locale-aware link button. */
export function Button({
  href,
  variant = "primary",
  size = "md",
  iconRight,
  className,
  children,
}: CommonProps & { href: ComponentProps<typeof Link>["href"] }) {
  return (
    <Link href={href} className={classes(variant, size, className)}>
      {inner(iconRight, children)}
    </Link>
  );
}

/** External anchor button (opens in a new tab). */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  iconRight,
  className,
  children,
  newTab = true,
}: CommonProps & { href: string; newTab?: boolean }) {
  return (
    <a
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={classes(variant, size, className)}
    >
      {inner(iconRight, children)}
    </a>
  );
}

/** Native button (for client actions). */
export function ButtonAction({
  variant = "primary",
  size = "md",
  iconRight,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button className={classes(variant, size, className)} {...rest}>
      {inner(iconRight, children)}
    </button>
  );
}
