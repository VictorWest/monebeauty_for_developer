import { Prisma } from "@prisma/client";
import {
  clinicDateFromInstant,
  clinicDateTimeToInstant,
  clinicTimeFromInstant,
  clinicWeekday,
} from "@/lib/clinic-time";

export const CALENDAR_BLOCK_SNAP_MIN = 15;
export const CALENDAR_BLOCK_MAX_OCCURRENCES = 500;
export const CALENDAR_BLOCK_MAX_MONTHS = 12;

export type BlockItemInput = { templateId: string; durationMin: number };

export function snapToCalendarQuarter(value: Date) {
  const snapped = new Date(value);
  snapped.setUTCSeconds(0, 0);
  snapped.setUTCMinutes(
    Math.round(snapped.getUTCMinutes() / CALENDAR_BLOCK_SNAP_MIN) *
      CALENDAR_BLOCK_SNAP_MIN,
  );
  return snapped;
}

export function sequentialDurationMinutes(
  items: Pick<BlockItemInput, "durationMin">[],
) {
  return items.reduce((total, item) => total + item.durationMin, 0);
}

export function endFromSequentialItems(
  start: Date,
  items: Pick<BlockItemInput, "durationMin">[],
) {
  return new Date(start.getTime() + sequentialDurationMinutes(items) * 60_000);
}

export function adjustFinalItemDuration(
  start: Date,
  end: Date,
  items: BlockItemInput[],
) {
  if (!items.length) return [];
  const total = Math.round((end.getTime() - start.getTime()) / 60_000);
  const preceding = sequentialDurationMinutes(items.slice(0, -1));
  const finalDuration = total - preceding;
  if (
    finalDuration < CALENDAR_BLOCK_SNAP_MIN ||
    finalDuration % CALENDAR_BLOCK_SNAP_MIN
  )
    throw new Error("invalid_duration");
  return items.map((item, index) =>
    index === items.length - 1 ? { ...item, durationMin: finalDuration } : item,
  );
}

export function expandCalendarRecurrence(input: {
  start: Date;
  weekdays?: number[];
  endDate?: Date | null;
  limit?: number;
}) {
  const limit = input.limit ?? CALENDAR_BLOCK_MAX_OCCURRENCES;
  if (!input.endDate || !input.weekdays?.length) return [new Date(input.start)];
  const startDate = clinicDateFromInstant(input.start);
  const endDate = clinicDateFromInstant(input.endDate);
  const time = clinicTimeFromInstant(input.start);
  const lastAllowed = new Date(`${startDate}T00:00:00Z`);
  lastAllowed.setUTCFullYear(lastAllowed.getUTCFullYear() + 1);
  const lastAllowedDate = lastAllowed.toISOString().slice(0, 10);
  if (endDate < startDate || endDate > lastAllowedDate)
    throw new Error("invalid_recurrence_range");
  const weekdays = new Set(input.weekdays);
  if ([...weekdays].some((day) => !Number.isInteger(day) || day < 0 || day > 6))
    throw new Error("invalid_weekday");
  const results: Date[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= endDate) {
    const date = cursor.toISOString().slice(0, 10);
    const weekday = clinicWeekday(date);
    if (weekday !== null && weekdays.has(weekday)) {
      const occurrence = clinicDateTimeToInstant(date, time);
      if (!occurrence) throw new Error("invalid_recurrence_time");
      results.push(occurrence);
      if (results.length > limit) throw new Error("occurrence_limit");
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!results.length) throw new Error("no_occurrences");
  return results;
}

type Transaction = Prisma.TransactionClient;
export type ReservationInput = {
  start: Date;
  end: Date;
  practitionerIds: string[];
  roomId?: string | null;
  deviceId?: string | null;
  excludeAppointmentId?: string;
  excludeBlockId?: string;
};

function dayKeys(input: ReservationInput) {
  const day = clinicDateFromInstant(input.start);
  return [
    ...input.practitionerIds.map((id) => `employee:${id}:${day}`),
    ...(input.roomId ? [`room:${input.roomId}:${day}`] : []),
    ...(input.deviceId ? [`device:${input.deviceId}:${day}`] : []),
  ].sort();
}

export async function lockReservationKeys(
  tx: Transaction,
  input: ReservationInput,
) {
  for (const key of dayKeys(input)) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

export async function findReservationConflict(
  tx: Transaction,
  input: ReservationInput,
) {
  const appointment = await tx.appointment.findFirst({
    where: {
      ...(input.excludeAppointmentId
        ? { id: { not: input.excludeAppointmentId } }
        : {}),
      status: { not: "CANCELLED" },
      start: { lt: input.end },
      OR: [
        { reservedUntil: { gt: input.start } },
        { reservedUntil: null, end: { gt: input.start } },
      ],
      AND: [
        {
          OR: [
            ...input.practitionerIds.map((practitionerId) => ({
              practitionerId,
            })),
            ...(input.roomId ? [{ roomId: input.roomId }] : []),
            ...(input.deviceId ? [{ deviceId: input.deviceId }] : []),
          ],
        },
      ],
    },
    select: { id: true, practitionerId: true, roomId: true, deviceId: true },
  });
  if (appointment) {
    const resource = input.practitionerIds.includes(appointment.practitionerId)
      ? `employee:${appointment.practitionerId}`
      : appointment.roomId === input.roomId
        ? `room:${appointment.roomId}`
        : `device:${appointment.deviceId}`;
    return { kind: "appointment" as const, id: appointment.id, resource };
  }

  const block = await tx.calendarBlock.findFirst({
    where: {
      ...(input.excludeBlockId ? { id: { not: input.excludeBlockId } } : {}),
      status: "ACTIVE",
      start: { lt: input.end },
      end: { gt: input.start },
      OR: [
        {
          participants: {
            some: { practitionerId: { in: input.practitionerIds } },
          },
        },
        ...(input.roomId ? [{ roomId: input.roomId }] : []),
        ...(input.deviceId ? [{ deviceId: input.deviceId }] : []),
      ],
    },
    select: {
      id: true,
      roomId: true,
      deviceId: true,
      participants: { select: { practitionerId: true } },
    },
  });
  if (!block) return null;
  const employee = block.participants.find((participant) =>
    input.practitionerIds.includes(participant.practitionerId),
  );
  const resource = employee
    ? `employee:${employee.practitionerId}`
    : block.roomId === input.roomId
      ? `room:${block.roomId}`
      : `device:${block.deviceId}`;
  return { kind: "block" as const, id: block.id, resource };
}

export async function lockAndFindReservationConflict(
  tx: Transaction,
  input: ReservationInput,
) {
  await lockReservationKeys(tx, input);
  return findReservationConflict(tx, input);
}
