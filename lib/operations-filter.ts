export type OperationsFilters = {
  q: string;
  status: string;
  from: string;
  to: string;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HELSINKI_TIME_ZONE = "Europe/Helsinki";

export function validCalendarDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeOperationsRange(from: string, to: string) {
  let normalizedFrom = validCalendarDate(from) ? from : "";
  let normalizedTo = validCalendarDate(to) ? to : "";
  if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
    [normalizedFrom, normalizedTo] = [normalizedTo, normalizedFrom];
  }
  return { from: normalizedFrom, to: normalizedTo };
}

function calendarParts(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid calendar date: ${value}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function helsinkiMidnight(value: string) {
  const desired = calendarParts(value);
  const desiredAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: HELSINKI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = desiredAsUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value ?? 0);
    const representedAsUtc = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    instant += desiredAsUtc - representedAsUtc;
  }
  return new Date(instant);
}

function nextCalendarDate(value: string) {
  const { year, month, day } = calendarParts(value);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function operationsDateRange(from: string, to: string) {
  const normalized = normalizeOperationsRange(from, to);
  const range: { gte?: Date; lt?: Date } = {};
  if (normalized.from) range.gte = helsinkiMidnight(normalized.from);
  if (normalized.to)
    range.lt = helsinkiMidnight(nextCalendarDate(normalized.to));
  return Object.keys(range).length ? range : undefined;
}

export function operationsFilterQuery(
  filters: OperationsFilters,
  page?: number,
) {
  const query = new URLSearchParams();
  const q = filters.q.trim();
  if (q) query.set("q", q);
  if (filters.status) query.set("status", filters.status);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (page && page > 1) query.set("page", String(page));
  return query.toString();
}
