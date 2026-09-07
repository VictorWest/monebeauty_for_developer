"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ThemedSelect, type SelectOption } from "@/components/ui/ThemedSelect";
import { auditFilterQuery, type AuditFilters } from "@/lib/audit-filter";

const input =
  "min-h-[44px] rounded-[4px] border border-line-btn bg-page px-[12px] font-sans text-[15px] text-ink";

export function AuditLogFilter({
  initial,
  staffOptions,
  labels,
}: {
  initial: AuditFilters;
  staffOptions: SelectOption[];
  labels: {
    allStaff: string;
    action: string;
    outcomes: string;
    filtering: string;
    automatic: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const actionReady = useRef(false);
  const actionTimer = useRef<number | null>(null);
  const normalizationDone = useRef(false);

  function replace(next: AuditFilters) {
    const query = auditFilterQuery(next);
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
    const canonical = auditFilterQuery(
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
    if (!actionReady.current) {
      actionReady.current = true;
      return;
    }
    actionTimer.current = window.setTimeout(() => replace(filters), 350);
    return () => {
      if (actionTimer.current !== null) {
        window.clearTimeout(actionTimer.current);
        actionTimer.current = null;
      }
    };
    // Only free-text action filtering is debounced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.action]);

  function changeImmediate(patch: Partial<AuditFilters>) {
    if (actionTimer.current !== null) {
      window.clearTimeout(actionTimer.current);
      actionTimer.current = null;
    }
    const next = { ...filters, ...patch };
    setFilters(next);
    replace(next);
  }

  const exportQuery = auditFilterQuery(filters);
  const exportHref = `/api/admin/audit/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <div>
      <div className="mt-[20px] grid gap-[10px] rounded-[8px] border border-line-card bg-card p-[14px] md:grid-cols-[minmax(180px,1fr)_minmax(240px,1.3fr)_minmax(180px,1fr)_auto] md:items-end">
        <ThemedSelect
          value={filters.staff}
          onValueChange={(staff) => changeImmediate({ staff })}
          ariaLabel={labels.allStaff}
          placeholder={labels.allStaff}
          options={staffOptions}
        />
        <input
          type="search"
          value={filters.action}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              action: event.target.value.slice(0, 80),
            }))
          }
          placeholder={labels.action}
          aria-label={labels.action}
          className={input}
        />
        <ThemedSelect
          value={filters.outcome}
          onValueChange={(outcome) =>
            changeImmediate({ outcome: outcome as AuditFilters["outcome"] })
          }
          ariaLabel={labels.outcomes}
          placeholder={labels.outcomes}
          options={[
            { value: "", label: labels.outcomes },
            { value: "SUCCESS", label: "SUCCESS" },
            { value: "FAILURE", label: "FAILURE" },
            { value: "DENIED", label: "DENIED" },
          ]}
        />
        <a
          className="inline-flex min-h-[44px] items-center justify-center rounded-[4px] border border-line-btn px-[16px] font-sans text-[13px]"
          href={exportHref}
        >
          CSV
        </a>
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
