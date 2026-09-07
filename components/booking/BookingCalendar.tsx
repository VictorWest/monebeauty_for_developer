"use client";

import { BUSINESS_HOURS } from "@/lib/booking-config";
import { CalendarGrid } from "@/components/ui/CalendarPicker";
import { clinicTodayYmd } from "@/lib/clinic-date";

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Booking month grid with clinic-day, business-day, and booking-window limits. */
export function BookingCalendar({
  locale,
  value,
  onSelect,
  availableDates,
  loading = false,
}: {
  locale: string;
  value: string | null;
  onSelect: (value: string) => void;
  availableDates?: readonly string[];
  loading?: boolean;
}) {
  const today = clinicTodayYmd();
  return (
    <div aria-busy={loading}>
      <CalendarGrid
        locale={locale}
        value={value ?? ""}
        onSelect={onSelect}
        min={today}
        max={addDays(today, BUSINESS_HOURS.daysAhead)}
        disableClosedDays
        availableDates={availableDates}
      />
    </div>
  );
}
