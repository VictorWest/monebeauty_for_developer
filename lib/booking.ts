import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BUSINESS_HOURS, MAX_GROUP_PROCEDURES } from "@/lib/booking-config";
import type { Locale } from "@/i18n/routing";
import {
  coveredAvailabilityStarts,
  generateStaffSlots,
  normalizeSlots,
  parseWorkingHours,
  type WorkingHoursInput,
} from "@/lib/staff-schedule";
import {
  clinicDateBounds,
  clinicTimeFromInstant,
  parseClinicDateTime,
} from "@/lib/clinic-time";
import {
  qualifiedSpecialists,
  type PublicSpecialist,
} from "@/lib/booking-specialists";

export { BUSINESS_HOURS, MAX_GROUP_PROCEDURES };

const DEFAULT_DURATION_MIN = 60;
export const APPOINTMENT_BUFFER_MINUTES = 10;
type SchedulingClient = Prisma.TransactionClient | typeof prisma;

export interface SlotDto {
  start: string;
  end: string;
  label: string;
  practitionerId: string;
  roomId: string;
  deviceId: string | null;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function logicalDate(dateStr: string) {
  const parsed = parseClinicDateTime(dateStr);
  return parsed
    ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
    : null;
}

function addDays(dateStr: string, amount: number) {
  const date = logicalDate(dateStr);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Candidate starts for a clinic date, represented as real instants. */
export function generateSlots(
  dateStr: string,
  durationMin: number,
  input: Partial<WorkingHoursInput> = {},
): Date[] {
  const schedule = parseWorkingHours(input);
  const availability = generateStaffSlots(dateStr, schedule);
  return coveredAvailabilityStarts(availability, durationMin);
}

async function serviceRecord(
  client: SchedulingClient,
  serviceKey: string,
  locale?: Locale,
  optionKey?: string,
  specialistId?: string,
) {
  const db = client as typeof prisma;
  const service = await db.service.findFirst({
    where: {
      slug: serviceKey,
      bookable: true,
      archivedAt: null,
      ...(locale
        ? { contents: { some: { locale, status: "PUBLISHED" } } }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      durationMin: true,
      requiresDevice: true,
      options: {
        where: {
          key: optionKey ?? "__parent_service__",
          type: { in: ["APPOINTMENT", "COURSE"] },
          bookable: true,
          published: true,
          archivedAt: null,
          ...(locale
            ? { contents: { some: { locale, status: "PUBLISHED" } } }
            : {}),
        },
        select: {
          id: true,
          bookingDurationMin: true,
          bookingService: {
            select: {
              id: true,
              slug: true,
              durationMin: true,
              requiresDevice: true,
              capabilities: {
                where: {
                  practitioner: {
                    active: true,
                    ...(specialistId ? { id: specialistId } : {}),
                  },
                  room: { active: true },
                },
                orderBy: [
                  { practitioner: { displayOrder: "asc" } },
                  { room: { displayOrder: "asc" } },
                ],
                select: {
                  practitioner: {
                    select: { id: true, workingHours: true },
                  },
                  room: { select: { id: true } },
                  devices: {
                    where: { device: { active: true } },
                    orderBy: { device: { displayOrder: "asc" } },
                    select: { device: { select: { id: true } } },
                  },
                },
              },
            },
          },
        },
        take: 1,
      },
      capabilities: {
        where: {
          practitioner: {
            active: true,
            ...(specialistId ? { id: specialistId } : {}),
          },
          room: { active: true },
        },
        orderBy: [
          { practitioner: { displayOrder: "asc" } },
          { room: { displayOrder: "asc" } },
        ],
        select: {
          practitioner: { select: { id: true, workingHours: true } },
          room: { select: { id: true } },
          devices: {
            where: { device: { active: true } },
            orderBy: { device: { displayOrder: "asc" } },
            select: { device: { select: { id: true } } },
          },
        },
      },
    },
  });
  if (!service || (optionKey && !service.options.length)) return null;
  const option = optionKey ? service.options[0] : null;
  return service
    ? {
        svc: option?.bookingService ?? service,
        serviceId: service.id,
        option,
      }
    : null;
}

function candidateAvailability(
  dateStr: string,
  durationMin: number,
  override: unknown | undefined,
  workingHours: unknown,
) {
  const available =
    override === undefined
      ? generateStaffSlots(dateStr, parseWorkingHours(workingHours))
      : normalizeSlots(override);
  return coveredAvailabilityStarts(available, durationMin);
}

/** Shared by the single-option and multi-procedure-group candidate search. */
async function fetchBookingConflicts(
  db: typeof prisma,
  args: {
    logicalDates: Date[];
    firstBounds: { start: Date; end: Date };
    lastBounds: { start: Date; end: Date };
    practitionerIds: string[];
    roomIds: string[];
    deviceIds: string[];
  },
) {
  const resourceOr = [
    { practitionerId: { in: args.practitionerIds } },
    { roomId: { in: args.roomIds } },
    ...(args.deviceIds.length ? [{ deviceId: { in: args.deviceIds } }] : []),
  ];
  const [availabilityRows, booked, blocked] = await Promise.all([
    db.availability.findMany({
      where: {
        practitionerId: { in: args.practitionerIds },
        date: { in: args.logicalDates },
      },
      select: { practitionerId: true, date: true, slots: true },
    }),
    db.appointment.findMany({
      where: {
        status: { not: "CANCELLED" },
        start: { lt: args.lastBounds.end },
        OR: [
          { reservedUntil: { gt: args.firstBounds.start } },
          { reservedUntil: null, end: { gt: args.firstBounds.start } },
        ],
        AND: [{ OR: resourceOr }],
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
        start: { lt: args.lastBounds.end },
        end: { gt: args.firstBounds.start },
        OR: [
          {
            participants: {
              some: { practitionerId: { in: args.practitionerIds } },
            },
          },
          { roomId: { in: args.roomIds } },
          ...(args.deviceIds.length
            ? [{ deviceId: { in: args.deviceIds } }]
            : []),
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
    availabilityRows.map((row) => [
      `${row.practitionerId}:${row.date.toISOString().slice(0, 10)}`,
      row.slots,
    ]),
  );
  return { booked, blocked, overrides };
}

async function collectSlotCandidates(
  {
    dates,
    serviceKey,
    locale,
    optionKey,
    specialistId,
  }: {
    dates: string[];
    serviceKey: string;
    locale?: Locale;
    optionKey?: string;
    specialistId?: string;
  },
  client: SchedulingClient = prisma,
): Promise<SlotDto[]> {
  if (!dates.length) return [];
  const db = client as typeof prisma;
  if (specialistId) {
    if (!optionKey) return [];
    const specialists = await qualifiedSpecialists(
      { serviceKey, optionKey, locale },
      client,
    );
    if (!specialists.some((item) => item.id === specialistId)) return [];
  }
  const record = await serviceRecord(
    client,
    serviceKey,
    locale,
    optionKey,
    specialistId,
  );
  if (!record) return [];
  const duration =
    record.option?.bookingDurationMin ??
    record.svc.durationMin ??
    DEFAULT_DURATION_MIN;
  const completeCapabilities = record.svc.capabilities.filter(
    (item) => !record.svc.requiresDevice || item.devices.length > 0,
  );
  const practitionerIds = Array.from(
    new Set(completeCapabilities.map((item) => item.practitioner.id)),
  );
  if (!completeCapabilities.length || !practitionerIds.length) return [];

  const firstBounds = clinicDateBounds(dates[0]);
  const lastBounds = clinicDateBounds(dates.at(-1)!);
  const logicalDates = dates
    .map(logicalDate)
    .filter((date): date is Date => Boolean(date));
  if (!firstBounds || !lastBounds || logicalDates.length !== dates.length)
    return [];

  const roomIds = Array.from(
    new Set(completeCapabilities.map((item) => item.room.id)),
  );
  const deviceIds = Array.from(
    new Set(
      completeCapabilities.flatMap((item) =>
        item.devices.map((link) => link.device.id),
      ),
    ),
  );
  const { booked, blocked, overrides } = await fetchBookingConflicts(db, {
    logicalDates,
    firstBounds,
    lastBounds,
    practitionerIds,
    roomIds,
    deviceIds,
  });

  const practitionerOrder = new Map(
    practitionerIds.map((id, index) => [id, index]),
  );
  const roomOrder = new Map(roomIds.map((id, index) => [id, index]));
  const deviceOrder = new Map(deviceIds.map((id, index) => [id, index]));
  const now = Date.now();
  const out: SlotDto[] = [];
  const startsByPractitionerDate = new Map<string, Date[]>();

  for (const dateStr of dates) {
    for (const capability of completeCapabilities) {
      const practitioner = capability.practitioner;
      const key = `${practitioner.id}:${dateStr}`;
      let starts = startsByPractitionerDate.get(key);
      if (!starts) {
        starts = candidateAvailability(
          dateStr,
          duration + APPOINTMENT_BUFFER_MINUTES,
          overrides.has(key) ? overrides.get(key) : undefined,
          practitioner.workingHours,
        );
        startsByPractitionerDate.set(key, starts);
      }
      for (const start of starts) {
        if (start.getTime() <= now) continue;
        const end = new Date(start.getTime() + duration * 60_000);
        const reservedUntil = new Date(
          end.getTime() + APPOINTMENT_BUFFER_MINUTES * 60_000,
        );
        const employeeBusy =
          booked.some(
            (appointment) =>
              appointment.practitionerId === practitioner.id &&
              overlaps(
                start,
                reservedUntil,
                appointment.start,
                appointment.reservedUntil ?? appointment.end,
              ),
          ) ||
          blocked.some(
            (block) =>
              block.participants.some(
                (participant) => participant.practitionerId === practitioner.id,
              ) && overlaps(start, reservedUntil, block.start, block.end),
          );
        if (employeeBusy) continue;

        // Rooms are allocated internally at the clinic depending on the day and
        // never gate online availability: `room` below is recorded on the
        // appointment purely for internal/admin visibility, not checked for
        // conflicts here.
        const room = capability.room;
        const freeDevices = record.svc.requiresDevice
          ? capability.devices
              .map((link) => link.device)
              .filter(
                (device) =>
                  booked.every(
                    (appointment) =>
                      appointment.deviceId !== device.id ||
                      !overlaps(
                        start,
                        reservedUntil,
                        appointment.start,
                        appointment.reservedUntil ?? appointment.end,
                      ),
                  ) &&
                  blocked.every(
                    (block) =>
                      block.deviceId !== device.id ||
                      !overlaps(start, reservedUntil, block.start, block.end),
                  ),
              )
          : [null];
        for (const device of freeDevices) {
          out.push({
            start: start.toISOString(),
            end: end.toISOString(),
            label: clinicTimeFromInstant(start),
            practitionerId: practitioner.id,
            roomId: room.id,
            deviceId: device?.id ?? null,
          });
        }
      }
    }
  }

  return out.sort(
    (left, right) =>
      left.start.localeCompare(right.start) ||
      (practitionerOrder.get(left.practitionerId) ?? 0) -
        (practitionerOrder.get(right.practitionerId) ?? 0) ||
      (roomOrder.get(left.roomId) ?? 0) - (roomOrder.get(right.roomId) ?? 0) ||
      (left.deviceId ? (deviceOrder.get(left.deviceId) ?? 0) : -1) -
        (right.deviceId ? (deviceOrder.get(right.deviceId) ?? 0) : -1),
  );
}

// ---------------------------------------------------------------------------
// Multi-procedure booking: several options from one service, performed by one
// specialist back-to-back in a single visit (e.g. laser hair removal — arms,
// legs, and neck in one appointment). A 1-option "group" is never valid here;
// callers with a single option keep using the functions above.
// ---------------------------------------------------------------------------

export interface GroupSlotLeg {
  optionKey: string;
  start: string;
  end: string;
  deviceId: string | null;
}

export interface GroupSlotDto {
  start: string;
  end: string;
  label: string;
  practitionerId: string;
  roomId: string;
  legs: GroupSlotLeg[];
}

type ResolvedGroupLeg = {
  optionKey: string;
  duration: number;
  requiresDevice: boolean;
  // One merged entry per eligible practitioner (a practitioner can hold
  // several capability rows — different rooms — for the same leg; rooms
  // never gate booking, so their device pools are simply unioned).
  practitioners: Map<
    string,
    { workingHours: unknown; roomId: string; deviceIds: string[] }
  >;
};

async function resolveGroupLegs(
  client: SchedulingClient,
  serviceKey: string,
  optionKeys: string[],
  locale: Locale | undefined,
  specialistId: string | undefined,
): Promise<ResolvedGroupLeg[] | null> {
  const legs: ResolvedGroupLeg[] = [];
  for (const optionKey of optionKeys) {
    if (specialistId) {
      const specialists = await qualifiedSpecialists(
        { serviceKey, optionKey, locale },
        client,
      );
      if (!specialists.some((item) => item.id === specialistId)) return null;
    }
    const record = await serviceRecord(
      client,
      serviceKey,
      locale,
      optionKey,
      specialistId,
    );
    if (!record) return null;
    const duration =
      record.option?.bookingDurationMin ??
      record.svc.durationMin ??
      DEFAULT_DURATION_MIN;
    const completeCapabilities = record.svc.capabilities.filter(
      (item) => !record.svc.requiresDevice || item.devices.length > 0,
    );
    if (!completeCapabilities.length) return null;

    const practitioners = new Map<
      string,
      { workingHours: unknown; roomId: string; deviceIds: string[] }
    >();
    for (const capability of completeCapabilities) {
      const deviceIds = capability.devices.map((link) => link.device.id);
      const existing = practitioners.get(capability.practitioner.id);
      if (existing) {
        for (const id of deviceIds) {
          if (!existing.deviceIds.includes(id)) existing.deviceIds.push(id);
        }
      } else {
        practitioners.set(capability.practitioner.id, {
          workingHours: capability.practitioner.workingHours,
          roomId: capability.room.id,
          deviceIds,
        });
      }
    }
    legs.push({
      optionKey,
      duration,
      requiresDevice: record.svc.requiresDevice,
      practitioners,
    });
  }
  return legs;
}

async function collectGroupSlotCandidates(
  {
    dates,
    serviceKey,
    optionKeys,
    locale,
    specialistId,
  }: {
    dates: string[];
    serviceKey: string;
    optionKeys: string[];
    locale?: Locale;
    specialistId?: string;
  },
  client: SchedulingClient = prisma,
): Promise<GroupSlotDto[]> {
  if (!dates.length) return [];
  if (optionKeys.length < 2 || optionKeys.length > MAX_GROUP_PROCEDURES)
    return [];
  const db = client as typeof prisma;

  const legs = await resolveGroupLegs(
    client,
    serviceKey,
    optionKeys,
    locale,
    specialistId,
  );
  if (!legs) return [];

  const practitionerIds = Array.from(
    legs
      .map((leg) => new Set(leg.practitioners.keys()))
      .reduce((eligible, ids) => new Set([...eligible].filter((id) => ids.has(id)))),
  );
  if (!practitionerIds.length) return [];

  const totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);

  const firstBounds = clinicDateBounds(dates[0]);
  const lastBounds = clinicDateBounds(dates.at(-1)!);
  const logicalDates = dates
    .map(logicalDate)
    .filter((date): date is Date => Boolean(date));
  if (!firstBounds || !lastBounds || logicalDates.length !== dates.length)
    return [];

  const roomIds = Array.from(
    new Set(
      legs.flatMap((leg) =>
        practitionerIds
          .map((id) => leg.practitioners.get(id)?.roomId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  const deviceIds = Array.from(
    new Set(
      legs.flatMap((leg) =>
        practitionerIds.flatMap(
          (id) => leg.practitioners.get(id)?.deviceIds ?? [],
        ),
      ),
    ),
  );

  const { booked, blocked, overrides } = await fetchBookingConflicts(db, {
    logicalDates,
    firstBounds,
    lastBounds,
    practitionerIds,
    roomIds,
    deviceIds,
  });

  const now = Date.now();
  const out: GroupSlotDto[] = [];

  for (const dateStr of dates) {
    for (const practitionerId of practitionerIds) {
      const key = `${practitionerId}:${dateStr}`;
      const firstLegInfo = legs[0].practitioners.get(practitionerId)!;
      const blockStarts = candidateAvailability(
        dateStr,
        totalDuration + APPOINTMENT_BUFFER_MINUTES,
        overrides.has(key) ? overrides.get(key) : undefined,
        firstLegInfo.workingHours,
      );
      for (const blockStart of blockStarts) {
        if (blockStart.getTime() <= now) continue;
        const blockEnd = new Date(
          blockStart.getTime() + totalDuration * 60_000,
        );
        const reservedUntil = new Date(
          blockEnd.getTime() + APPOINTMENT_BUFFER_MINUTES * 60_000,
        );

        const practitionerBusy =
          booked.some(
            (appointment) =>
              appointment.practitionerId === practitionerId &&
              overlaps(
                blockStart,
                reservedUntil,
                appointment.start,
                appointment.reservedUntil ?? appointment.end,
              ),
          ) ||
          blocked.some(
            (block) =>
              block.participants.some(
                (participant) => participant.practitionerId === practitionerId,
              ) && overlaps(blockStart, reservedUntil, block.start, block.end),
          );
        if (practitionerBusy) continue;

        // Walk the legs in order, each getting its own sub-interval of the
        // block and (if it needs a device) a device free for that
        // sub-interval alone — this is what lets two legs share the same
        // physical device as long as they never run at the same time, which
        // they never do for one specialist working sequentially.
        const resolvedLegs: GroupSlotLeg[] = [];
        let cursor = blockStart;
        let roomId: string | null = null;
        let legRejected = false;
        for (const leg of legs) {
          const legEnd = new Date(cursor.getTime() + leg.duration * 60_000);
          const info = leg.practitioners.get(practitionerId)!;
          roomId ??= info.roomId;
          let deviceId: string | null = null;
          if (leg.requiresDevice) {
            const freeDevice = info.deviceIds.find(
              (id) =>
                booked.every(
                  (appointment) =>
                    appointment.deviceId !== id ||
                    !overlaps(
                      cursor,
                      legEnd,
                      appointment.start,
                      appointment.reservedUntil ?? appointment.end,
                    ),
                ) &&
                blocked.every(
                  (block) =>
                    block.deviceId !== id ||
                    !overlaps(cursor, legEnd, block.start, block.end),
                ) &&
                !resolvedLegs.some(
                  (done) =>
                    done.deviceId === id &&
                    overlaps(
                      cursor,
                      legEnd,
                      new Date(done.start),
                      new Date(done.end),
                    ),
                ),
            );
            if (!freeDevice) {
              legRejected = true;
              break;
            }
            deviceId = freeDevice;
          }
          resolvedLegs.push({
            optionKey: leg.optionKey,
            start: cursor.toISOString(),
            end: legEnd.toISOString(),
            deviceId,
          });
          cursor = legEnd;
        }
        if (legRejected) continue;

        out.push({
          start: blockStart.toISOString(),
          end: blockEnd.toISOString(),
          label: clinicTimeFromInstant(blockStart),
          practitionerId,
          roomId: roomId ?? "",
          legs: resolvedLegs,
        });
      }
    }
  }

  return out.sort((left, right) => left.start.localeCompare(right.start));
}

export async function openGroupSlots(args: {
  dateStr: string;
  serviceKey: string;
  optionKeys: string[];
  locale?: Locale;
  specialistId?: string;
}): Promise<{ start: string; end: string; label: string }[]> {
  const candidates = await collectGroupSlotCandidates({
    dates: [args.dateStr],
    serviceKey: args.serviceKey,
    optionKeys: args.optionKeys,
    locale: args.locale,
    specialistId: args.specialistId,
  });
  const seen = new Set<string>();
  return candidates
    .filter((slot) => {
      if (seen.has(slot.start)) return false;
      seen.add(slot.start);
      return true;
    })
    .map(({ start, end, label }) => ({ start, end, label }));
}

export async function openPublicGroupSlotCandidates(
  args: {
    dateStr: string;
    serviceKey: string;
    optionKeys: string[];
    locale?: Locale;
    start: string;
    specialistId?: string;
  },
  client: SchedulingClient = prisma,
): Promise<GroupSlotDto[]> {
  return (
    await collectGroupSlotCandidates(
      {
        dates: [args.dateStr],
        serviceKey: args.serviceKey,
        optionKeys: args.optionKeys,
        locale: args.locale,
        specialistId: args.specialistId,
      },
      client,
    )
  ).filter((slot) => slot.start === args.start);
}

/**
 * Qualified specialists for a multi-procedure cart: qualified for every
 * selected option (not just one) and actually on the schedule that date for
 * the combined block.
 */
export async function qualifiedSpecialistsForGroupDate(
  args: {
    dateStr: string;
    serviceKey: string;
    optionKeys: string[];
    locale?: Locale;
  },
  client: SchedulingClient = prisma,
): Promise<PublicSpecialist[]> {
  const perLeg = await Promise.all(
    args.optionKeys.map((optionKey) =>
      qualifiedSpecialists(
        { serviceKey: args.serviceKey, optionKey, locale: args.locale },
        client,
      ),
    ),
  );
  const [first, ...rest] = perLeg;
  const qualifiedEveryLeg = (first ?? []).filter((specialist) =>
    rest.every((list) => list.some((item) => item.id === specialist.id)),
  );
  const candidates = await collectGroupSlotCandidates(
    {
      dates: [args.dateStr],
      serviceKey: args.serviceKey,
      optionKeys: args.optionKeys,
      locale: args.locale,
    },
    client,
  );
  const workingToday = new Set(candidates.map((slot) => slot.practitionerId));
  return qualifiedEveryLeg.filter((specialist) => workingToday.has(specialist.id));
}

export async function openPublicGroupDates({
  fromDate,
  toDate,
  serviceKey,
  optionKeys,
  locale,
  specialistId,
}: {
  fromDate: string;
  toDate: string;
  serviceKey: string;
  optionKeys: string[];
  locale?: Locale;
  specialistId?: string;
}): Promise<string[]> {
  const dates: string[] = [];
  for (let date = fromDate; date && date <= toDate; date = addDays(date, 1)) {
    dates.push(date);
    if (dates.length > 63) break;
  }
  const candidates = await collectGroupSlotCandidates({
    dates,
    serviceKey,
    optionKeys,
    locale,
    specialistId,
  });
  const candidateTimes = candidates.map((slot) => Date.parse(slot.start));
  let candidateIndex = 0;
  return dates.filter((date) => {
    const bounds = clinicDateBounds(date);
    if (!bounds) return false;
    while (
      candidateIndex < candidateTimes.length &&
      candidateTimes[candidateIndex] < bounds.start.getTime()
    ) {
      candidateIndex += 1;
    }
    return (
      candidateIndex < candidateTimes.length &&
      candidateTimes[candidateIndex] < bounds.end.getTime()
    );
  });
}

/** Group-booking counterpart to `resolveAnySpecialist` — same compact
 * scheduling then workload balancing, sourced from the combined-block
 * candidates instead of a single procedure's. */
export async function resolveAnySpecialistForGroup(
  args: {
    dateStr: string;
    serviceKey: string;
    optionKeys: string[];
    locale?: Locale;
    start: string;
  },
  client: SchedulingClient = prisma,
): Promise<GroupSlotDto | null> {
  const db = client as typeof prisma;
  const candidates = await openPublicGroupSlotCandidates(args, client);
  const eligibleByPractitioner = new Map<string, GroupSlotDto>();
  for (const candidate of candidates) {
    if (!eligibleByPractitioner.has(candidate.practitionerId)) {
      eligibleByPractitioner.set(candidate.practitionerId, candidate);
    }
  }
  const eligible = Array.from(eligibleByPractitioner.values());
  if (!eligible.length) return null;
  if (eligible.length === 1) return eligible[0];

  const practitionerIds = eligible.map((item) => item.practitionerId);
  const dayBounds = clinicDateBounds(args.dateStr);
  const now = new Date();
  const workloadHorizon = new Date(now.getTime() + 14 * 86_400_000);
  const [dayCounts, upcomingCounts] = await Promise.all([
    dayBounds
      ? db.appointment.groupBy({
          by: ["practitionerId"],
          where: {
            practitionerId: { in: practitionerIds },
            status: { not: "CANCELLED" },
            start: { gte: dayBounds.start, lt: dayBounds.end },
          },
          _count: { _all: true },
        })
      : [],
    db.appointment.groupBy({
      by: ["practitionerId"],
      where: {
        practitionerId: { in: practitionerIds },
        status: { not: "CANCELLED" },
        start: { gte: now, lt: workloadHorizon },
      },
      _count: { _all: true },
    }),
  ]);
  const busyToday = new Map(
    dayCounts.map((row) => [row.practitionerId, row._count._all]),
  );
  const upcomingLoad = new Map(
    upcomingCounts.map((row) => [row.practitionerId, row._count._all]),
  );

  const withAppointmentsToday = eligible.filter(
    (item) => (busyToday.get(item.practitionerId) ?? 0) > 0,
  );
  const pool = withAppointmentsToday.length ? withAppointmentsToday : eligible;

  return pool.reduce((lightest, candidate) =>
    (upcomingLoad.get(candidate.practitionerId) ?? 0) <
    (upcomingLoad.get(lightest.practitionerId) ?? 0)
      ? candidate
      : lightest,
  );
}

export async function openSlots(args: {
  dateStr: string;
  serviceKey: string;
  locale?: Locale;
  optionKey?: string;
  specialistId?: string;
}): Promise<SlotDto[]> {
  const candidates = await collectSlotCandidates({
    dates: [args.dateStr],
    serviceKey: args.serviceKey,
    locale: args.locale,
    optionKey: args.optionKey,
    specialistId: args.specialistId,
  });
  const seen = new Set<string>();
  return candidates.filter((slot) => {
    if (seen.has(slot.start)) return false;
    seen.add(slot.start);
    return true;
  });
}

export async function openPublicSlotCandidates(
  args: {
    dateStr: string;
    serviceKey: string;
    locale?: Locale;
    start: string;
    optionKey?: string;
    specialistId?: string;
  },
  client: SchedulingClient = prisma,
) {
  return (
    await collectSlotCandidates(
      {
        dates: [args.dateStr],
        serviceKey: args.serviceKey,
        locale: args.locale,
        optionKey: args.optionKey,
        specialistId: args.specialistId,
      },
      client,
    )
  ).filter((slot) => slot.start === args.start);
}

/**
 * Qualified specialists who are additionally on the schedule for the given
 * clinic date, per the booking flow's Treatment -> Date -> Specialist order:
 * "the system should display specialists who perform that specific treatment
 * and are actually working on the selected date."
 */
export async function qualifiedSpecialistsForDate(
  args: {
    dateStr: string;
    serviceKey: string;
    optionKey: string;
    locale?: Locale;
  },
  client: SchedulingClient = prisma,
): Promise<PublicSpecialist[]> {
  const [qualified, candidates] = await Promise.all([
    qualifiedSpecialists(args, client),
    collectSlotCandidates(
      {
        dates: [args.dateStr],
        serviceKey: args.serviceKey,
        optionKey: args.optionKey,
        locale: args.locale,
      },
      client,
    ),
  ]);
  const workingToday = new Set(candidates.map((slot) => slot.practitionerId));
  return qualified.filter((specialist) => workingToday.has(specialist.id));
}

/**
 * Resolves the "Any Specialist" choice to one concrete, currently-eligible
 * practitioner for the exact requested slot, per the clinic's assignment
 * rules:
 *   1. Compact scheduling: prefer a specialist who already has at least
 *      one appointment that clinic day, rather than opening an isolated
 *      appointment for someone otherwise idle that day.
 *   2. Workload balancing: among the preferred pool, pick whoever has the
 *      lightest upcoming (next 14 days) load, so bookings don't keep
 *      stacking onto the same specialist.
 * Returns null if nobody is actually eligible for that exact slot anymore
 * (e.g. it was taken between the client loading times and picking one).
 */
export async function resolveAnySpecialist(
  args: {
    dateStr: string;
    serviceKey: string;
    locale?: Locale;
    start: string;
    optionKey?: string;
  },
  client: SchedulingClient = prisma,
): Promise<SlotDto | null> {
  const db = client as typeof prisma;
  const candidates = await openPublicSlotCandidates(args, client);
  const eligibleByPractitioner = new Map<string, SlotDto>();
  for (const candidate of candidates) {
    if (!eligibleByPractitioner.has(candidate.practitionerId)) {
      eligibleByPractitioner.set(candidate.practitionerId, candidate);
    }
  }
  const eligible = Array.from(eligibleByPractitioner.values());
  if (!eligible.length) return null;
  if (eligible.length === 1) return eligible[0];

  const practitionerIds = eligible.map((item) => item.practitionerId);
  const dayBounds = clinicDateBounds(args.dateStr);
  const now = new Date();
  const workloadHorizon = new Date(now.getTime() + 14 * 86_400_000);
  const [dayCounts, upcomingCounts] = await Promise.all([
    dayBounds
      ? db.appointment.groupBy({
          by: ["practitionerId"],
          where: {
            practitionerId: { in: practitionerIds },
            status: { not: "CANCELLED" },
            start: { gte: dayBounds.start, lt: dayBounds.end },
          },
          _count: { _all: true },
        })
      : [],
    db.appointment.groupBy({
      by: ["practitionerId"],
      where: {
        practitionerId: { in: practitionerIds },
        status: { not: "CANCELLED" },
        start: { gte: now, lt: workloadHorizon },
      },
      _count: { _all: true },
    }),
  ]);
  const busyToday = new Map(
    dayCounts.map((row) => [row.practitionerId, row._count._all]),
  );
  const upcomingLoad = new Map(
    upcomingCounts.map((row) => [row.practitionerId, row._count._all]),
  );

  // Priority 1: compact scheduling.
  const withAppointmentsToday = eligible.filter(
    (item) => (busyToday.get(item.practitionerId) ?? 0) > 0,
  );
  const pool = withAppointmentsToday.length ? withAppointmentsToday : eligible;

  // Priority 2: workload balancing within the preferred pool.
  return pool.reduce((lightest, candidate) =>
    (upcomingLoad.get(candidate.practitionerId) ?? 0) <
    (upcomingLoad.get(lightest.practitionerId) ?? 0)
      ? candidate
      : lightest,
  );
}

export async function openPublicDates({
  fromDate,
  toDate,
  serviceKey,
  locale,
  optionKey,
  specialistId,
}: {
  fromDate: string;
  toDate: string;
  serviceKey: string;
  locale?: Locale;
  optionKey?: string;
  specialistId?: string;
}): Promise<string[]> {
  const dates: string[] = [];
  for (let date = fromDate; date && date <= toDate; date = addDays(date, 1)) {
    dates.push(date);
    if (dates.length > 63) break;
  }
  const candidates = await collectSlotCandidates({
    dates,
    serviceKey,
    locale,
    optionKey,
    specialistId,
  });
  // Candidates are already ordered by start. Walk them once instead of rebuilding
  // Helsinki date boundaries for every date/candidate pair.
  const candidateTimes = candidates.map((slot) => Date.parse(slot.start));
  let candidateIndex = 0;
  return dates.filter((date) => {
    const bounds = clinicDateBounds(date);
    if (!bounds) return false;
    while (
      candidateIndex < candidateTimes.length &&
      candidateTimes[candidateIndex] < bounds.start.getTime()
    ) {
      candidateIndex += 1;
    }
    return (
      candidateIndex < candidateTimes.length &&
      candidateTimes[candidateIndex] < bounds.end.getTime()
    );
  });
}

export async function openPublicSlots(args: {
  dateStr: string;
  serviceKey: string;
  locale?: Locale;
  optionKey?: string;
  specialistId?: string;
}) {
  return openSlots(args);
}

export async function getFirstActivePractitionerId(): Promise<string> {
  const practitioner = await prisma.practitioner.findFirst({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (!practitioner) throw new Error("employee_required");
  return practitioner.id;
}

export async function getServiceId(serviceKey: string): Promise<string> {
  const existing = await serviceRecord(prisma, serviceKey);
  if (!existing) throw new Error("unknown_service");
  return existing.serviceId;
}

export async function appointmentByReference(reference: string) {
  const id = reference.trim();
  if (!id) return null;
  return prisma.appointment.findFirst({
    where: { OR: [{ id }, { id: { endsWith: id } }] },
    include: { client: true, service: true },
  });
}
