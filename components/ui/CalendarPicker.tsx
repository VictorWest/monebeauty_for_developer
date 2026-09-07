"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { BUSINESS_HOURS } from "@/lib/booking-config";
import { clinicTodayYmd, ymd } from "@/lib/clinic-date";
import { cn } from "@/lib/cn";
import { ThemedSelect } from "@/components/ui/ThemedSelect";

type CalendarNavigation = "arrows" | "dateOfBirth";

const CALENDAR_COPY = {
  en: {
    previousMonth: "Previous month",
    nextMonth: "Next month",
    month: "Month",
    year: "Year",
    clear: "Clear date",
    dialog: "Choose a date",
    required: "Choose a date.",
  },
  fi: {
    previousMonth: "Edellinen kuukausi",
    nextMonth: "Seuraava kuukausi",
    month: "Kuukausi",
    year: "Vuosi",
    clear: "Tyhjennä päivämäärä",
    dialog: "Valitse päivämäärä",
    required: "Valitse päivämäärä.",
  },
  ru: {
    previousMonth: "Предыдущий месяц",
    nextMonth: "Следующий месяц",
    month: "Месяц",
    year: "Год",
    clear: "Очистить дату",
    dialog: "Выберите дату",
    required: "Выберите дату.",
  },
} as const;

function calendarCopy(locale: string) {
  return (
    CALENDAR_COPY[locale as keyof typeof CALENDAR_COPY] ?? CALENDAR_COPY.en
  );
}

function calendarDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}

function fourDigitYear(year: number) {
  return String(year).padStart(4, "0");
}

function parseYmd(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = calendarDate(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
    ? null
    : date;
}

function monthStart(date: Date) {
  return calendarDate(date.getFullYear(), date.getMonth(), 1);
}

export function CalendarGrid({
  locale,
  value,
  onSelect,
  min,
  max,
  disableClosedDays = true,
  availableDates,
  onMonthChange,
  navigation = "arrows",
}: {
  locale: string;
  value?: string;
  onSelect: (value: string) => void;
  min?: string;
  max?: string;
  disableClosedDays?: boolean;
  availableDates?: readonly string[];
  onMonthChange?: (from: string, to: string) => void;
  navigation?: CalendarNavigation;
}) {
  const selected = value ? parseYmd(value) : null;
  const minimum = min ? parseYmd(min) : null;
  const maximum = max ? parseYmd(max) : null;
  const [view, setView] = useState(() =>
    monthStart(selected ?? minimum ?? parseYmd(clinicTodayYmd()) ?? new Date()),
  );
  const year = view.getFullYear();
  const month = view.getMonth();
  const copy = calendarCopy(locale);
  const [yearDraft, setYearDraft] = useState(fourDigitYear(year));
  const yearId = useId();
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  });
  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
  });
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
  });
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(new Date(2024, 0, 1 + index)),
  );
  const offset = (calendarDate(year, month, 1).getDay() + 6) % 7;
  const days = calendarDate(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, index) =>
      calendarDate(year, month, index + 1),
    ),
  ];
  const previousMonth = calendarDate(year, month - 1, 1);
  const nextMonth = calendarDate(year, month + 1, 1);
  const canPrevious = !minimum || previousMonth >= monthStart(minimum);
  const canNext = !maximum || nextMonth <= monthStart(maximum);
  const available = availableDates ? new Set(availableDates) : null;
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const candidate = calendarDate(year, index, 1);
    return {
      value: String(index),
      label: new Intl.DateTimeFormat(locale, { month: "long" }).format(
        candidate,
      ),
      disabled:
        Boolean(minimum && candidate < monthStart(minimum)) ||
        Boolean(maximum && candidate > monthStart(maximum)),
    };
  });

  function navigate(next: Date) {
    setView(next);
    setYearDraft(fourDigitYear(next.getFullYear()));
  }

  useEffect(() => {
    if (!onMonthChange) return;
    const from = ymd(new Date(year, month, 1));
    const to = ymd(new Date(year, month + 1, 0));
    onMonthChange(from, to);
  }, [month, onMonthChange, year]);

  return (
    <div className="w-[min(340px,calc(100vw-32px))] rounded-[var(--radius)] border border-line-card bg-card p-[16px]">
      <div className="mb-[12px] flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!canPrevious}
          onClick={() => navigate(previousMonth)}
          aria-label={copy.previousMonth}
          className="grid size-11 place-items-center rounded-[6px] text-ink hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CaretLeft size={16} weight="bold" />
        </button>
        {navigation === "dateOfBirth" ? (
          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_88px] gap-2">
            <ThemedSelect
              options={monthOptions}
              value={String(month)}
              onValueChange={(next) =>
                navigate(calendarDate(year, Number(next), 1))
              }
              ariaLabel={copy.month}
              className="[&_button]:min-h-11 [&_button]:capitalize"
            />
            <label className="sr-only" htmlFor={yearId}>
              {copy.year}
            </label>
            <input
              id={yearId}
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              aria-label={copy.year}
              value={yearDraft}
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, "").slice(0, 4);
                setYearDraft(next);
                if (next.length !== 4) return;
                const requested = Number(next);
                const minimumYear = minimum?.getFullYear() ?? 1;
                const maximumYear = maximum?.getFullYear() ?? 9999;
                const bounded = Math.min(
                  maximumYear,
                  Math.max(minimumYear, requested),
                );
                navigate(calendarDate(bounded, month, 1));
              }}
              onBlur={() => setYearDraft(fourDigitYear(year))}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                  return;
                event.preventDefault();
                const next = calendarDate(
                  year + (event.key === "ArrowUp" ? 1 : -1),
                  month,
                  1,
                );
                if (
                  (!minimum || next >= monthStart(minimum)) &&
                  (!maximum || next <= monthStart(maximum))
                ) {
                  navigate(next);
                }
              }}
              className="min-h-11 w-full rounded-[4px] border border-line-btn bg-page px-2 text-center font-sans text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
          </div>
        ) : (
          <span className="font-display text-[18px] font-medium text-ink capitalize">
            {monthFormatter.format(view)}
          </span>
        )}
        <button
          type="button"
          disabled={!canNext}
          onClick={() => navigate(nextMonth)}
          aria-label={copy.nextMonth}
          className="grid size-11 place-items-center rounded-[6px] text-ink hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CaretRight size={16} weight="bold" />
        </button>
      </div>
      <div role="grid" className="grid grid-cols-7 gap-[2px]">
        {weekdayLabels.map((label, index) => (
          <div
            key={index}
            role="columnheader"
            className="grid h-[30px] place-items-center font-sans text-meta tracking-[.02em] text-muted uppercase"
          >
            {label.slice(0, 2)}
          </div>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} aria-hidden />;
          const dateValue = ymd(date);
          const disabled =
            Boolean(minimum && date < minimum) ||
            Boolean(maximum && date > maximum) ||
            (disableClosedDays &&
              !available &&
              !BUSINESS_HOURS.openDays.includes(date.getDay())) ||
            Boolean(available && !available.has(dateValue));
          const active = dateValue === value;
          return (
            <button
              key={dateValue}
              type="button"
              role="gridcell"
              aria-label={dayFormatter.format(date)}
              aria-selected={active}
              disabled={disabled}
              onClick={() => onSelect(dateValue)}
              className={cn(
                "grid aspect-square min-h-[40px] place-items-center rounded-[6px] font-sans text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                active
                  ? "bg-accent text-page"
                  : disabled
                    ? "cursor-not-allowed text-muted/35"
                    : "text-ink hover:bg-btn-fill",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({
  locale,
  name,
  value,
  defaultValue = "",
  onValueChange,
  id,
  ariaLabel,
  placeholder = "Select date",
  min,
  max,
  disableClosedDays = true,
  availableDates,
  onMonthChange,
  clearable = false,
  required = false,
  autoComplete,
  navigation = "arrows",
  className,
}: {
  locale: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disableClosedDays?: boolean;
  availableDates?: readonly string[];
  onMonthChange?: (from: string, to: string) => void;
  clearable?: boolean;
  required?: boolean;
  autoComplete?: string;
  navigation?: CalendarNavigation;
  className?: string;
}) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const popoverId = useId();
  const copy = calendarCopy(locale);
  const selectedDate = selectedValue ? parseYmd(selectedValue) : null;
  const label = selectedDate
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
        selectedDate,
      )
    : placeholder;

  useEffect(() => {
    function close(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
        setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    function validate(event: SubmitEvent) {
      if (!required || selectedValue) return;
      event.preventDefault();
      setInvalid(true);
      triggerRef.current?.focus();
    }
    function reset() {
      if (!controlled) setInternalValue(defaultValue);
      setInvalid(false);
      setOpen(false);
    }
    form.addEventListener("submit", validate);
    form.addEventListener("reset", reset);
    return () => {
      form.removeEventListener("submit", validate);
      form.removeEventListener("reset", reset);
    };
  }, [controlled, defaultValue, required, selectedValue]);

  function select(next: string) {
    if (!controlled) setInternalValue(next);
    if (next) setInvalid(false);
    onValueChange?.(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={selectedValue}
          required={required}
          autoComplete={autoComplete}
        />
      ) : null}
      <div className="flex min-h-[44px] items-stretch rounded-[4px] border border-line-btn bg-page focus-within:border-accent">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center justify-between gap-[10px] px-[12px] font-sans text-[15px] tracking-normal text-ink normal-case outline-none"
        >
          <span className={cn("truncate", !selectedDate && "text-muted")}>
            {label}
          </span>
          <CalendarBlank size={18} weight="regular" className="shrink-0" />
        </button>
        {clearable && selectedValue ? (
          <button
            type="button"
            aria-label={copy.clear}
            onClick={() => select("")}
            className="grid w-11 place-items-center border-l border-line-hair text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <X size={16} weight="regular" />
          </button>
        ) : null}
      </div>
      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={ariaLabel ?? copy.dialog}
          className="absolute top-[calc(100%+6px)] left-0 z-[90] shadow-[var(--shadow-card)]"
        >
          <CalendarGrid
            locale={locale}
            value={selectedValue}
            onSelect={select}
            min={min}
            max={max}
            disableClosedDays={disableClosedDays}
            availableDates={availableDates}
            onMonthChange={onMonthChange}
            navigation={navigation}
          />
        </div>
      ) : null}
      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 font-sans text-xs text-[#9f3030]"
        >
          {copy.required}
        </p>
      ) : null}
    </div>
  );
}
