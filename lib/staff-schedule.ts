import { BUSINESS_HOURS } from "@/lib/booking-config";
import {
  CLINIC_TIME_ZONE,
  clinicDateFromInstant,
  clinicDateMinuteToInstant,
  clinicTimeFromInstant,
  clinicWeekday,
  parseClinicDateTime,
} from "@/lib/clinic-time";

export type StaffSlotStatus = "open" | "closed" | "booked";

export type StaffSlot = {
  start: string;
  end: string;
  status: StaffSlotStatus;
};

export type WorkingMinuteRange = { startMinute: number; endMinute: number };
export type WeeklyIntervals = Record<string, WorkingMinuteRange[]>;

/** UTC-midnight representation used by Prisma `@db.Date` fields. */
export function dateFromYmd(value: string) {
  const parsed = parseClinicDateTime(value);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

/** Clinic-local date label for timestamps and UTC-midnight database dates. */
export function ymdFromDate(value: Date) {
  return clinicDateFromInstant(value);
}

/** Derived legacy fields keep older UI/API callers compatible during the v2 rollout. */
export type WorkingHoursInput = {
  version: 2;
  timezone: typeof CLINIC_TIME_ZONE;
  intervals: WeeklyIntervals;
  openDays: number[];
  startHour: number;
  endHour: number;
  stepMin: number;
};

type WorkingHoursValue = Partial<WorkingHoursInput> & {
  intervals?: unknown;
};

function validRange(value: unknown): WorkingMinuteRange | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as { startMinute?: unknown; endMinute?: unknown };
  const startMinute = Number(raw.startMinute);
  const endMinute = Number(raw.endMinute);
  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > 1440 ||
    startMinute >= endMinute ||
    startMinute % 15 !== 0 ||
    endMinute % 15 !== 0
  )
    return null;
  return { startMinute, endMinute };
}

function mergeRanges(values: WorkingMinuteRange[]) {
  const sorted = [...values].sort(
    (left, right) => left.startMinute - right.startMinute,
  );
  const merged: WorkingMinuteRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.startMinute <= previous.endMinute) {
      previous.endMinute = Math.max(previous.endMinute, range.endMinute);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function normalizeIntervals(value: unknown): WeeklyIntervals | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const normalized: WeeklyIntervals = {};
  for (let day = 0; day <= 6; day += 1) {
    const raw = source[String(day)];
    normalized[String(day)] = Array.isArray(raw)
      ? mergeRanges(
          raw
            .map(validRange)
            .filter((range): range is WorkingMinuteRange => Boolean(range)),
        )
      : [];
  }
  return normalized;
}

function legacyIntervals(input: Partial<WorkingHoursInput>) {
  const openDays = Array.isArray(input.openDays)
    ? input.openDays
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : BUSINESS_HOURS.openDays;
  const startHour = Number.isInteger(input.startHour)
    ? Math.min(22, Math.max(0, Number(input.startHour)))
    : BUSINESS_HOURS.startHour;
  const endHour = Number.isInteger(input.endHour)
    ? Math.min(24, Math.max(startHour + 1, Number(input.endHour)))
    : BUSINESS_HOURS.endHour;
  const intervals: WeeklyIntervals = {};
  for (let day = 0; day <= 6; day += 1) {
    intervals[String(day)] = openDays.includes(day)
      ? [{ startMinute: startHour * 60, endMinute: endHour * 60 }]
      : [];
  }
  return intervals;
}

export function normalizeWorkingHours(value: unknown): WorkingHoursInput {
  const input: WorkingHoursValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as WorkingHoursValue)
      : {};
  const intervals =
    normalizeIntervals(input.intervals) ?? legacyIntervals(input);
  const all = Object.values(intervals).flat();
  const openDays = Array.from({ length: 7 }, (_, day) => day).filter(
    (day) => intervals[String(day)].length > 0,
  );
  const earliest = all.length
    ? Math.min(...all.map((range) => range.startMinute))
    : BUSINESS_HOURS.startHour * 60;
  const latest = all.length
    ? Math.max(...all.map((range) => range.endMinute))
    : BUSINESS_HOURS.endHour * 60;
  const stepMin = [15, 30, 45, 60, 90, 120].includes(Number(input.stepMin))
    ? Number(input.stepMin)
    : 15;
  return {
    version: 2,
    timezone: CLINIC_TIME_ZONE,
    intervals,
    openDays,
    startHour: Math.floor(earliest / 60),
    endHour: Math.ceil(latest / 60),
    stepMin,
  };
}

export function parseWorkingHours(value: unknown): WorkingHoursInput {
  return normalizeWorkingHours(value);
}

export function scheduleStorageValue(value: unknown) {
  const schedule = parseWorkingHours(value);
  return {
    version: schedule.version,
    timezone: schedule.timezone,
    stepMin: schedule.stepMin,
    intervals: schedule.intervals,
  };
}

export function rangesForDate(dateStr: string, value: unknown) {
  const weekday = clinicWeekday(dateStr);
  if (weekday === null) return [];
  return parseWorkingHours(value).intervals[String(weekday)] ?? [];
}

export function workingRangeForDate(
  dateStr: string,
  value: unknown,
): WorkingMinuteRange | null {
  const ranges = rangesForDate(dateStr, value);
  if (!ranges.length) return null;
  return {
    startMinute: Math.min(...ranges.map((range) => range.startMinute)),
    endMinute: Math.max(...ranges.map((range) => range.endMinute)),
  };
}

export function openSlotRange(value: unknown): WorkingMinuteRange | null {
  const open = normalizeSlots(value).filter((slot) => slot.status === "open");
  if (!open.length) return null;
  return open.reduce<WorkingMinuteRange | null>((range, slot) => {
    const startLabel = clinicTimeFromInstant(new Date(slot.start));
    const endLabel = clinicTimeFromInstant(new Date(slot.end));
    const startMinute =
      Number(startLabel.slice(0, 2)) * 60 + Number(startLabel.slice(3));
    const endMinute =
      Number(endLabel.slice(0, 2)) * 60 + Number(endLabel.slice(3));
    return range
      ? {
          startMinute: Math.min(range.startMinute, startMinute),
          endMinute: Math.max(range.endMinute, endMinute),
        }
      : { startMinute, endMinute };
  }, null);
}

function slotForMinutes(
  dateStr: string,
  startMinute: number,
  endMinute: number,
  status: StaffSlotStatus = "open",
): StaffSlot | null {
  const start = clinicDateMinuteToInstant(dateStr, startMinute);
  const end = clinicDateMinuteToInstant(dateStr, endMinute);
  if (!start || !end || end <= start) return null;
  return { start: start.toISOString(), end: end.toISOString(), status };
}

export function generateStaffSlots(
  dateStr: string,
  input: Partial<WorkingHoursInput> = {},
): StaffSlot[] {
  if (!parseClinicDateTime(dateStr)) return [];
  const hours = normalizeWorkingHours(input);
  const weekday = clinicWeekday(dateStr);
  if (weekday === null) return [];
  const out: StaffSlot[] = [];
  for (const range of hours.intervals[String(weekday)] ?? []) {
    for (
      let minute = range.startMinute;
      minute + hours.stepMin <= range.endMinute;
      minute += hours.stepMin
    ) {
      const slot = slotForMinutes(dateStr, minute, minute + hours.stepMin);
      if (slot) out.push(slot);
    }
  }
  return out;
}

export function slotsWithBookedStatus(
  slots: StaffSlot[],
  appointments: Array<{ start: Date; end: Date; status: string }>,
): StaffSlot[] {
  return slots.map((slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    const booked = appointments.some(
      (appointment) =>
        appointment.status !== "CANCELLED" &&
        start < appointment.end &&
        end > appointment.start,
    );
    return booked ? { ...slot, status: "booked" } : slot;
  });
}

export function normalizeSlots(value: unknown): StaffSlot[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const raw = slot as { start?: unknown; end?: unknown; status?: unknown };
      const start = String(raw.start ?? "");
      const end = String(raw.end ?? "");
      const status = String(raw.status ?? "open");
      if (
        Number.isNaN(Date.parse(start)) ||
        Number.isNaN(Date.parse(end)) ||
        new Date(end) <= new Date(start)
      )
        return null;
      if (!["open", "closed", "booked"].includes(status)) return null;
      return { start, end, status: status as StaffSlotStatus };
    })
    .filter((slot): slot is StaffSlot => Boolean(slot));
}

export function applyAvailabilityRange(
  rawSlots: unknown,
  dateStr: string,
  startMinute: number,
  endMinute: number,
  status: "open" | "closed",
): StaffSlot[] {
  if (
    !parseClinicDateTime(dateStr) ||
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > 1440 ||
    startMinute >= endMinute ||
    startMinute % 15 !== 0 ||
    endMinute % 15 !== 0
  )
    return [];

  const quarters = new Map<number, "open" | "closed">();
  for (const slot of normalizeSlots(rawSlots)) {
    const startLabel = clinicTimeFromInstant(new Date(slot.start));
    const endLabel = clinicTimeFromInstant(new Date(slot.end));
    const from =
      Number(startLabel.slice(0, 2)) * 60 + Number(startLabel.slice(3));
    const to = Number(endLabel.slice(0, 2)) * 60 + Number(endLabel.slice(3));
    for (let minute = from; minute + 15 <= to; minute += 15) {
      quarters.set(minute, slot.status === "closed" ? "closed" : "open");
    }
  }
  for (let minute = startMinute; minute < endMinute; minute += 15) {
    quarters.set(minute, status);
  }

  return [...quarters]
    .sort(([left], [right]) => left - right)
    .map(([minute, quarterStatus]) =>
      slotForMinutes(dateStr, minute, minute + 15, quarterStatus),
    )
    .filter((slot): slot is StaffSlot => Boolean(slot));
}

export function workdaySlots(
  dateStr: string,
  startMinute: number,
  endMinute: number,
): StaffSlot[] {
  return applyAvailabilityRange([], dateStr, startMinute, endMinute, "open");
}

function mergedOpenCoverage(rawSlots: unknown) {
  const intervals = normalizeSlots(rawSlots)
    .filter((slot) => slot.status === "open")
    .map((slot) => ({
      start: new Date(slot.start).getTime(),
      end: new Date(slot.end).getTime(),
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

export function availabilityCovers(rawSlots: unknown, start: Date, end: Date) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return mergedOpenCoverage(rawSlots).some(
    (interval) => interval.start <= startMs && interval.end >= endMs,
  );
}

/** Candidate starts whose contiguous open coverage can fit the full service. */
export function coveredAvailabilityStarts(
  rawSlots: unknown,
  durationMin: number,
) {
  const durationMs = durationMin * 60_000;
  const coverage = mergedOpenCoverage(rawSlots);
  const starts = new Set(
    normalizeSlots(rawSlots)
      .filter((slot) => slot.status === "open")
      .map((slot) => new Date(slot.start).getTime()),
  );
  return [...starts]
    .filter((start) =>
      coverage.some(
        (interval) =>
          interval.start <= start && interval.end >= start + durationMs,
      ),
    )
    .sort((left, right) => left - right)
    .map((start) => new Date(start));
}

/**
 * Compares effective open coverage, deliberately ignoring slot granularity.
 * This lets generated 15-minute rows match an equivalent 30-minute weekly
 * schedule while still preserving shortened, split, extended, and closed days.
 */
export function availabilityMatchesWeeklySchedule(
  dateStr: string,
  rawSlots: unknown,
  weekly: unknown,
) {
  const actual = mergedOpenCoverage(rawSlots);
  const expected = mergedOpenCoverage(
    generateStaffSlots(dateStr, parseWorkingHours(weekly)),
  );
  return (
    actual.length === expected.length &&
    actual.every(
      (interval, index) =>
        interval.start === expected[index]?.start &&
        interval.end === expected[index]?.end,
    )
  );
}
