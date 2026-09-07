"use client";

import { forwardRef, useId, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type AdminIconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> & {
  label: string;
  containerClassName?: string;
};

export const AdminIconButton = forwardRef<
  HTMLButtonElement,
  AdminIconButtonProps
>(function AdminIconButton(
  { label, containerClassName, className, children, type = "button", ...props },
  ref,
) {
  const tooltipId = useId();
  return (
    <span className={cn("group relative inline-flex", containerClassName)}>
      <button
        {...props}
        ref={ref}
        type={type}
        aria-label={label}
        aria-describedby={tooltipId}
        title={label}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[4px] text-ink transition-colors hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
      >
        {children}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute top-[calc(100%+7px)] left-1/2 z-[160] -translate-x-1/2 rounded-[4px] bg-ink px-2 py-1 font-sans text-[12px] whitespace-nowrap text-page opacity-0 shadow-card transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  );
});
