"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { SelectOption } from "./ThemedSelect";

export function TimePicker({
  options,
  name,
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Select time",
  ariaLabel,
  inline = false,
  disabled = false,
  className,
}: {
  options: SelectOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  inline?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(next: string) {
    if (!controlled) setInternalValue(next);
    onValueChange?.(next);
    if (!inline) setOpen(false);
  }

  const choices = (
    <div
      role="listbox"
      aria-label={ariaLabel}
      className="grid max-h-[280px] grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-[7px] overflow-y-auto p-[8px]"
    >
      {options
        .filter((option) => !option.disabled)
        .map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === selectedValue}
            disabled={option.disabled}
            onClick={() => choose(option.value)}
            className={cn(
              "min-h-[44px] rounded-[4px] border px-[11px] font-sans text-[14px] tracking-normal normal-case transition-colors",
              option.value === selectedValue
                ? "border-accent bg-btn-fill text-ink"
                : "border-line-btn bg-card text-body hover:border-line-btn-hover hover:text-ink",
              option.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {option.label}
          </button>
        ))}
    </div>
  );

  if (inline) {
    return (
      <div className={className}>
        {name ? (
          <input type="hidden" name={name} value={selectedValue} />
        ) : null}
        {choices}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[44px] w-full items-center justify-between gap-[10px] rounded-[4px] border border-line-btn bg-page px-[12px] font-sans text-[15px] tracking-normal text-ink normal-case outline-none hover:border-line-btn-hover focus:border-accent disabled:opacity-50"
      >
        <span className={cn("truncate", !selected && "text-muted")}>
          {selected?.label ?? placeholder}
        </span>
        <Clock size={18} weight="regular" />
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[90] w-[min(320px,calc(100vw-32px))] rounded-[7px] border border-line-card bg-card shadow-[var(--shadow-card)]">
          {choices}
        </div>
      ) : null}
    </div>
  );
}
