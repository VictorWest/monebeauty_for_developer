"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { selectMenuLayout, type SelectPlacement } from "@/lib/select-placement";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function ThemedSelect({
  options,
  value,
  defaultValue = "",
  onValueChange,
  name,
  id,
  ariaLabel,
  placeholder = "—",
  disabled = false,
  required = false,
  searchable = false,
  searchPlaceholder = "Search",
  className,
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [placement, setPlacement] = useState<SelectPlacement>("down");
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLLabelElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? options.filter((option) =>
          option.label.toLocaleLowerCase().includes(normalized),
        )
      : options;
  }, [options, query]);
  const selected = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form || controlled) return;
    function reset() {
      setInternalValue(defaultValue);
      setOpen(false);
      setQuery("");
    }
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue]);

  useLayoutEffect(() => {
    if (!open) return;

    function positionMenu() {
      const root = rootRef.current;
      const menu = menuRef.current;
      if (!root || !menu) return;
      const trigger = root.getBoundingClientRect();
      const menuHeight =
        Math.min(listRef.current?.scrollHeight ?? 0, 280) +
        (searchRef.current?.getBoundingClientRect().height ?? 0) +
        2;
      const layout = selectMenuLayout({
        triggerTop: trigger.top,
        triggerBottom: trigger.bottom,
        menuHeight,
        viewportHeight: window.innerHeight,
      });
      setPlacement((current) =>
        current === layout.placement ? current : layout.placement,
      );
      setMenuMaxHeight((current) =>
        current === layout.maxHeight ? current : layout.maxHeight,
      );
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, searchable, visibleOptions.length]);

  function choose(next: string) {
    if (!controlled) setInternalValue(next);
    onValueChange?.(next);
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLButtonElement>("[data-trigger]")
        ?.focus(),
    );
  }

  function openAt(index: number) {
    setOpen(true);
    setHighlighted(Math.max(0, index));
    window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      const selectedIndex = Math.max(
        0,
        visibleOptions.findIndex((option) => option.value === selectedValue),
      );
      openAt(
        event.key === "ArrowUp" ? visibleOptions.length - 1 : selectedIndex,
      );
    }
  }

  function onOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      rootRef.current
        ?.querySelector<HTMLButtonElement>("[data-trigger]")
        ?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      let next = index;
      do {
        next =
          (next + direction + visibleOptions.length) % visibleOptions.length;
      } while (visibleOptions[next]?.disabled && next !== index);
      setHighlighted(next);
      optionRefs.current[next]?.focus();
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : visibleOptions.length - 1;
      setHighlighted(next);
      optionRefs.current[next]?.focus();
    }
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        data-trigger
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        className="flex min-h-[44px] w-full items-center justify-between gap-[12px] rounded-[4px] border border-line-btn bg-page px-[12px] font-sans text-[15px] tracking-normal text-ink normal-case transition-colors outline-none hover:border-line-btn-hover focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("truncate", !selected && "text-muted")}>
          {selected?.label ?? placeholder}
        </span>
        <CaretDown
          size={15}
          weight="regular"
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          ref={menuRef}
          style={{ maxHeight: menuMaxHeight }}
          data-placement={placement}
          className={cn(
            "absolute left-0 z-[90] flex w-full min-w-[190px] flex-col overflow-hidden rounded-[7px] border border-line-card bg-card shadow-[var(--shadow-card)]",
            placement === "up"
              ? "bottom-[calc(100%+6px)]"
              : "top-[calc(100%+6px)]",
          )}
        >
          {searchable ? (
            <label
              ref={searchRef}
              className="flex items-center gap-[8px] border-b border-line-hair px-[11px]"
            >
              <MagnifyingGlass
                size={16}
                weight="regular"
                className="text-muted"
              />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlighted(0);
                }}
                placeholder={searchPlaceholder}
                className="min-h-[42px] min-w-0 flex-1 bg-transparent font-sans text-[14px] text-ink outline-none placeholder:text-muted"
              />
            </label>
          ) : null}
          <div
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            aria-required={required || undefined}
            className="max-h-[280px] min-h-0 flex-1 overflow-y-auto p-[5px]"
          >
            {visibleOptions.map((option, index) => {
              const active = option.value === selectedValue;
              return (
                <button
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  tabIndex={highlighted === index ? 0 : -1}
                  onFocus={() => setHighlighted(index)}
                  onKeyDown={(event) => onOptionKeyDown(event, index)}
                  onClick={() => choose(option.value)}
                  className={cn(
                    "flex min-h-[42px] w-full items-center justify-between gap-[12px] rounded-[4px] px-[11px] text-left font-sans text-[14px] tracking-normal normal-case transition-colors",
                    active
                      ? "bg-btn-fill text-accent"
                      : "text-body hover:bg-page hover:text-ink",
                    option.disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {active ? <Check size={15} weight="bold" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
