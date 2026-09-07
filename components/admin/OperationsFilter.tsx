"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import {
  normalizeOperationsRange,
  operationsFilterQuery,
  type OperationsFilters,
} from "@/lib/operations-filter";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { ThemedSelect, type SelectOption } from "@/components/ui/ThemedSelect";

const input =
  "min-h-[44px] rounded-[4px] border border-line-btn bg-page px-[12px] font-sans text-[15px] text-ink";

export function OperationsFilter({
  locale,
  initial,
  statusOptions,
  labels,
}: {
  locale: Locale;
  initial: OperationsFilters;
  statusOptions: SelectOption[];
  labels: {
    search: string;
    status: string;
    from: string;
    until: string;
    filtering: string;
    automatic: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [workingDates, setWorkingDates] = useState<string[] | undefined>();
  const searchReady = useRef(false);
  const normalizationDone = useRef(false);

  function replace(next: OperationsFilters) {
    const query = operationsFilterQuery(next);
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      }),
    );
  }

  useEffect(() => {
    if (normalizationDone.current) return;
    normalizationDone.current = true;
    const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
    const canonical = operationsFilterQuery(
      initial,
      Number.isFinite(rawPage) ? rawPage : undefined,
    );
    if (searchParams.toString() !== canonical) {
      router.replace(canonical ? `${pathname}?${canonical}` : pathname, {
        scroll: false,
      });
    }
  }, [initial, pathname, router, searchParams]);

  useEffect(() => {
    if (!searchReady.current) {
      searchReady.current = true;
      return;
    }
    const timeout = window.setTimeout(() => replace(filters), 350);
    return () => window.clearTimeout(timeout);
    // Search is the only debounced field; other controls call replace directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  function changeImmediate(patch: Partial<OperationsFilters>) {
    const next = { ...filters, ...patch };
    const range = normalizeOperationsRange(next.from, next.to);
    const normalized = { ...next, ...range };
    setFilters(normalized);
    replace(normalized);
  }

  const loadWorkingDates = useCallback(async (from: string, to: string) => {
    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/calendar/working-dates?${params}`);
      if (!response.ok) throw new Error("working_dates");
      const payload = (await response.json()) as { dates?: string[] };
      setWorkingDates(Array.isArray(payload.dates) ? payload.dates : undefined);
    } catch {
      setWorkingDates(undefined);
    }
  }, []);

  return (
    <div>
      <div className="mt-[20px] grid gap-[8px] md:grid-cols-[minmax(220px,2fr)_minmax(160px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)] md:items-end">
        <input
          type="search"
          value={filters.q}
          onChange={(event) =>
            setFilters((current) => ({ ...current, q: event.target.value }))
          }
          placeholder={labels.search}
          aria-label={labels.search}
          className={`${input} min-w-[240px] flex-1`}
        />
        <ThemedSelect
          value={filters.status}
          onValueChange={(status) => changeImmediate({ status })}
          options={statusOptions}
          ariaLabel={labels.status}
        />
        <label className="font-sans text-[13px] text-muted">
          {labels.from}
          <DatePicker
            locale={locale}
            value={filters.from}
            onValueChange={(from) => changeImmediate({ from })}
            max={filters.to || undefined}
            clearable
            ariaLabel={labels.from}
            placeholder={labels.from}
            className="mt-[6px]"
            availableDates={workingDates}
            onMonthChange={loadWorkingDates}
          />
        </label>
        <label className="font-sans text-[13px] text-muted">
          {labels.until}
          <DatePicker
            locale={locale}
            value={filters.to}
            onValueChange={(to) => changeImmediate({ to })}
            min={filters.from || undefined}
            clearable
            ariaLabel={labels.until}
            placeholder={labels.until}
            className="mt-[6px]"
            availableDates={workingDates}
            onMonthChange={loadWorkingDates}
          />
        </label>
      </div>
      <p
        className="mt-[7px] min-h-[18px] font-sans text-[12px] text-muted"
        role="status"
        aria-live="polite"
      >
        {isPending ? labels.filtering : labels.automatic}
      </p>
    </div>
  );
}
