import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const CALENDAR_DAY_START = 6;
export const CALENDAR_DAY_END = 22;
export const CALENDAR_SNAP_MIN = 15;
export const ACTIVE_APPOINTMENT_STATUSES = [
  "BOOKED",
  "CONFIRMED",
  "RESCHEDULED",
  "COMPLETED",
] as const;

export type CalendarConflict =
  | "stale"
  | "forbidden"
  | "invalid_time"
  | "invalid_employee"
  | "outside_availability"
  | "employee_overlap"
  | "invalid_room"
  | "room_overlap"
  | "device_required"
  | "invalid_device"
  | "device_overlap"
  | "not_movable";

export function dayBounds(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function staffPractitionerId(user: AuthUser) {
  if (user.role !== "STAFF") return null;
  const staff = await prisma.staffUser.findUnique({
    where: { userId: user.id },
    select: { practitionerId: true },
  });
  return staff?.practitionerId ?? null;
}

export function overlapsWhere(start: Date, end: Date, excludeId?: string) {
  return {
    ...(excludeId ? { id: { not: excludeId } } : {}),
    status: { not: "CANCELLED" as const },
    start: { lt: end },
    end: { gt: start },
  };
}

export function calendarUpdatedChanges(input: {
  previous: {
    start: Date;
    end: Date;
    practitionerId: string;
    roomId: string | null;
    deviceId: string | null;
  };
  next: {
    start: Date;
    end: Date;
    practitionerId: string;
    roomId: string | null;
    deviceId: string | null;
  };
}) {
  return {
    previous: {
      start: input.previous.start.toISOString(),
      end: input.previous.end.toISOString(),
      practitionerId: input.previous.practitionerId,
      roomId: input.previous.roomId,
      deviceId: input.previous.deviceId,
    },
    next: {
      start: input.next.start.toISOString(),
      end: input.next.end.toISOString(),
      practitionerId: input.next.practitionerId,
      roomId: input.next.roomId,
      deviceId: input.next.deviceId,
    },
  };
}
