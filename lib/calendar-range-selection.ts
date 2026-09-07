export type CalendarRangeColumn = {
  date: string;
  practitionerId: string;
};

export type CalendarRangeCell = CalendarRangeColumn & {
  columnIndex: number;
  minute: number;
};

export type CalendarRangeSelection = {
  startMinute: number;
  endMinute: number;
  startColumnIndex: number;
  endColumnIndex: number;
  targets: CalendarRangeColumn[];
};

export function normalizeCalendarRange(
  anchor: CalendarRangeCell,
  focus: CalendarRangeCell,
  columns: CalendarRangeColumn[],
): CalendarRangeSelection | null {
  if (
    !columns.length ||
    !Number.isInteger(anchor.columnIndex) ||
    !Number.isInteger(focus.columnIndex) ||
    anchor.columnIndex < 0 ||
    focus.columnIndex < 0 ||
    anchor.columnIndex >= columns.length ||
    focus.columnIndex >= columns.length ||
    !Number.isInteger(anchor.minute) ||
    !Number.isInteger(focus.minute) ||
    anchor.minute < 0 ||
    focus.minute < 0 ||
    anchor.minute >= 1440 ||
    focus.minute >= 1440 ||
    anchor.minute % 15 !== 0 ||
    focus.minute % 15 !== 0
  )
    return null;

  const startColumnIndex = anchor.columnIndex;
  const endColumnIndex = anchor.columnIndex;
  const startMinute = Math.min(anchor.minute, focus.minute);
  const endMinute = Math.max(anchor.minute, focus.minute) + 15;
  return {
    startMinute,
    endMinute,
    startColumnIndex,
    endColumnIndex,
    targets: [columns[anchor.columnIndex]],
  };
}

export function calendarRangeContains(
  selection: CalendarRangeSelection | null,
  columnIndex: number,
  minute: number,
) {
  return Boolean(
    selection &&
    columnIndex >= selection.startColumnIndex &&
    columnIndex <= selection.endColumnIndex &&
    minute >= selection.startMinute &&
    minute < selection.endMinute,
  );
}

export function groupCalendarRangeTargets(targets: CalendarRangeColumn[]) {
  const byDate = new Map<string, string[]>();
  for (const target of targets) {
    const current = byDate.get(target.date) ?? [];
    if (!current.includes(target.practitionerId))
      current.push(target.practitionerId);
    byDate.set(target.date, current);
  }
  return [...byDate].map(([date, practitionerIds]) => ({
    date,
    practitionerIds,
  }));
}

export function calendarRangeStart(date: string, minute: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || minute % 15 !== 0) return null;
  return (
    clinicDateTimeToInstant(date, minuteLabel(minute))?.toISOString() ?? null
  );
}
import { clinicDateTimeToInstant, minuteLabel } from "@/lib/clinic-time";
