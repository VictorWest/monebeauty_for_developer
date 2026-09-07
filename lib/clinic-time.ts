export const CLINIC_TIME_ZONE = "Europe/Helsinki";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsAt(value: Date) {
  const parts = formatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function sameWallTime(
  value: Date,
  desired: ReturnType<typeof parseClinicDateTime>,
) {
  if (!desired) return false;
  const actual = partsAt(value);
  return (
    actual.year === desired.year &&
    actual.month === desired.month &&
    actual.day === desired.day &&
    actual.hour === desired.hour &&
    actual.minute === desired.minute
  );
}

export function parseClinicDateTime(date: string, time = "00:00") {
  const dateMatch = DATE_RE.exec(date);
  const timeMatch = TIME_RE.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const desired = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
  if (
    desired.hour > 23 ||
    desired.minute > 59 ||
    desired.month < 1 ||
    desired.month > 12 ||
    desired.day < 1 ||
    desired.day > 31
  )
    return null;
  const check = new Date(
    Date.UTC(desired.year, desired.month - 1, desired.day),
  );
  if (
    check.getUTCFullYear() !== desired.year ||
    check.getUTCMonth() !== desired.month - 1 ||
    check.getUTCDate() !== desired.day
  )
    return null;
  return desired;
}

/** Convert a Helsinki wall time to a real instant. Repeated autumn times choose the earlier instant. */
export function clinicDateTimeToInstant(date: string, time: string) {
  const desired = parseClinicDateTime(date, time);
  if (!desired) return null;
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  let instant = desiredAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsAt(new Date(instant));
    const representedAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    instant += desiredAsUtc - representedAsUtc;
  }
  const candidate = new Date(instant);
  if (!sameWallTime(candidate, desired)) return null;

  // Autumn's repeated hour has two real instants. Select the earlier one consistently.
  const earlier = new Date(candidate.getTime() - 60 * 60_000);
  return sameWallTime(earlier, desired) ? earlier : candidate;
}

/** Convert a clinic-date minute, allowing 1440 as midnight at the next date. */
export function clinicDateMinuteToInstant(date: string, minute: number) {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) return null;
  if (minute < 1440) return clinicDateTimeToInstant(date, minuteLabel(minute));
  const parts = parseClinicDateTime(date);
  if (!parts) return null;
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return clinicDateTimeToInstant(nextDate, "00:00");
}

export function clinicDateFromInstant(value: Date) {
  const parts = partsAt(value);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function clinicTimeFromInstant(value: Date) {
  const parts = partsAt(value);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function clinicDateBounds(date: string) {
  const start = clinicDateTimeToInstant(date, "00:00");
  const parts = parseClinicDateTime(date);
  if (!start || !parts) return null;
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  const end = clinicDateTimeToInstant(nextDate, "00:00");
  return end ? { start, end } : null;
}

export function clinicWeekday(date: string) {
  const parts = parseClinicDateTime(date);
  return parts
    ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    : null;
}

export function minuteLabel(minute: number) {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) return "";
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
