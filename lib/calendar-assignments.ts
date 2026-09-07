import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  availabilityCovers,
  generateStaffSlots,
  normalizeSlots,
  parseWorkingHours,
  type StaffSlot,
} from "@/lib/staff-schedule";
import { clinicDateFromInstant } from "@/lib/clinic-time";

type SchedulingClient = Prisma.TransactionClient | typeof prisma;
const APPOINTMENT_BUFFER_MS = 15 * 60_000;

export type CalendarAssignment = {
  practitionerId: string;
  roomId: string;
  deviceId: string | null;
};

type Capability = {
  practitionerId: string;
  roomId: string;
  deviceIds: string[];
};

type Reservation = {
  practitionerIds: string[];
  roomId: string | null;
  deviceId: string | null;
  start: Date;
  end: Date;
};

function overlaps(start: Date, end: Date, reservation: Reservation) {
  return start < reservation.end && end > reservation.start;
}

export function filterCalendarAssignments(input: {
  start: Date;
  end: Date;
  requiresDevice: boolean;
  capabilities: Capability[];
  coverageByPractitioner: Map<string, StaffSlot[]>;
  reservations: Reservation[];
}) {
  const assignments: CalendarAssignment[] = [];
  const seen = new Set<string>();

  for (const capability of input.capabilities) {
    const coverage = input.coverageByPractitioner.get(
      capability.practitionerId,
    );
    if (!coverage || !availabilityCovers(coverage, input.start, input.end))
      continue;

    const overlapping = input.reservations.filter((reservation) =>
      overlaps(input.start, input.end, reservation),
    );
    if (
      overlapping.some((reservation) =>
        reservation.practitionerIds.includes(capability.practitionerId),
      ) ||
      overlapping.some(
        (reservation) => reservation.roomId === capability.roomId,
      )
    )
      continue;

    const deviceIds = input.requiresDevice ? capability.deviceIds : [null];
    for (const deviceId of deviceIds) {
      if (
        deviceId &&
        overlapping.some((reservation) => reservation.deviceId === deviceId)
      )
        continue;
      const key = `${capability.practitionerId}:${capability.roomId}:${deviceId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      assignments.push({
        practitionerId: capability.practitionerId,
        roomId: capability.roomId,
        deviceId,
      });
    }
  }

  return assignments;
}

export async function calendarAssignmentCandidates(
  input: {
    serviceId: string;
    start: Date;
    end: Date;
    excludeAppointmentId?: string;
    practitionerIds?: string[];
  },
  client: SchedulingClient = prisma,
) {
  const db = client as typeof prisma;
  const reservationEnd = new Date(input.end.getTime() + APPOINTMENT_BUFFER_MS);
  const service = await db.service.findFirst({
    where: { id: input.serviceId, bookable: true, archivedAt: null },
    select: {
      requiresDevice: true,
      capabilities: {
        where: {
          practitioner: {
            active: true,
            ...(input.practitionerIds?.length
              ? { id: { in: input.practitionerIds } }
              : {}),
          },
          room: { active: true },
        },
        orderBy: [
          { practitioner: { displayOrder: "asc" } },
          { practitioner: { name: "asc" } },
          { room: { displayOrder: "asc" } },
          { room: { name: "asc" } },
        ],
        select: {
          practitionerId: true,
          roomId: true,
          practitioner: { select: { workingHours: true } },
          devices: {
            where: { device: { active: true } },
            orderBy: [
              { device: { displayOrder: "asc" } },
              { device: { name: "asc" } },
            ],
            select: { deviceId: true },
          },
        },
      },
    },
  });
  if (!service) return null;

  const completeCapabilities = service.capabilities.filter(
    (capability) => !service.requiresDevice || capability.devices.length > 0,
  );
  const practitionerIds = [
    ...new Set(completeCapabilities.map((item) => item.practitionerId)),
  ];
  if (!practitionerIds.length) return [];
  const roomIds = [...new Set(completeCapabilities.map((item) => item.roomId))];
  const deviceIds = [
    ...new Set(
      completeCapabilities.flatMap((item) =>
        item.devices.map((device) => device.deviceId),
      ),
    ),
  ];
  const dateStr = clinicDateFromInstant(input.start);
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const [availability, appointments, blocks] = await Promise.all([
    db.availability.findMany({
      where: { practitionerId: { in: practitionerIds }, date },
      select: { practitionerId: true, slots: true },
    }),
    db.appointment.findMany({
      where: {
        ...(input.excludeAppointmentId
          ? { id: { not: input.excludeAppointmentId } }
          : {}),
        status: { not: "CANCELLED" },
        start: { lt: reservationEnd },
        OR: [
          { reservedUntil: { gt: input.start } },
          { reservedUntil: null, end: { gt: input.start } },
        ],
        AND: [
          {
            OR: [
              { practitionerId: { in: practitionerIds } },
              { roomId: { in: roomIds } },
              ...(deviceIds.length ? [{ deviceId: { in: deviceIds } }] : []),
            ],
          },
        ],
      },
      select: {
        practitionerId: true,
        roomId: true,
        deviceId: true,
        start: true,
        end: true,
        reservedUntil: true,
      },
    }),
    db.calendarBlock.findMany({
      where: {
        status: "ACTIVE",
        start: { lt: reservationEnd },
        end: { gt: input.start },
        OR: [
          {
            participants: {
              some: { practitionerId: { in: practitionerIds } },
            },
          },
          { roomId: { in: roomIds } },
          ...(deviceIds.length ? [{ deviceId: { in: deviceIds } }] : []),
        ],
      },
      select: {
        roomId: true,
        deviceId: true,
        start: true,
        end: true,
        participants: { select: { practitionerId: true } },
      },
    }),
  ]);

  const overrides = new Map(
    availability.map((row) => [row.practitionerId, normalizeSlots(row.slots)]),
  );
  const coverageByPractitioner = new Map<string, StaffSlot[]>();
  for (const capability of completeCapabilities) {
    if (coverageByPractitioner.has(capability.practitionerId)) continue;
    coverageByPractitioner.set(
      capability.practitionerId,
      overrides.get(capability.practitionerId) ??
        generateStaffSlots(
          dateStr,
          parseWorkingHours(capability.practitioner.workingHours),
        ),
    );
  }

  return filterCalendarAssignments({
    start: input.start,
    end: reservationEnd,
    requiresDevice: service.requiresDevice,
    capabilities: completeCapabilities.map((capability) => ({
      practitionerId: capability.practitionerId,
      roomId: capability.roomId,
      deviceIds: capability.devices.map((device) => device.deviceId),
    })),
    coverageByPractitioner,
    reservations: [
      ...appointments.map((appointment) => ({
        practitionerIds: [appointment.practitionerId],
        roomId: appointment.roomId,
        deviceId: appointment.deviceId,
        start: appointment.start,
        end: appointment.reservedUntil ?? appointment.end,
      })),
      ...blocks.map((block) => ({
        practitionerIds: block.participants.map(
          (participant) => participant.practitionerId,
        ),
        roomId: block.roomId,
        deviceId: block.deviceId,
        start: block.start,
        end: block.end,
      })),
    ],
  });
}
