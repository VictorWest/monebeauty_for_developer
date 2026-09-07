import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { getFirstActivePractitionerId } from "@/lib/booking";
import type { AuthUser } from "@/lib/auth";
import {
  applyAvailabilityRange,
  availabilityCovers,
  dateFromYmd,
  generateStaffSlots,
  normalizeSlots,
  normalizeWorkingHours,
  parseWorkingHours,
  scheduleStorageValue,
  slotsWithBookedStatus,
  workdaySlots,
  ymdFromDate,
} from "@/lib/staff-schedule";
import { clinicTodayYmd } from "@/lib/clinic-date";
import { lockReservationKeys } from "@/lib/calendar-blocks";
import {
  clinicDateBounds,
  clinicDateFromInstant,
  clinicDateTimeToInstant,
  minuteLabel,
} from "@/lib/clinic-time";

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

async function resolvePractitionerId(_user: AuthUser, requested?: unknown) {
  const id = String(requested ?? "");
  return id || getFirstActivePractitionerId();
}

export async function GET(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return forbidden();
  const { searchParams } = new URL(req.url);
  const practitionerId = await resolvePractitionerId(
    user,
    searchParams.get("practitionerId"),
  );
  if (!practitionerId) return forbidden();
  const rangeFrom = searchParams.get("from");
  const rangeTo = searchParams.get("to");
  if (rangeFrom && rangeTo) {
    const from = dateFromYmd(rangeFrom);
    const to = dateFromYmd(rangeTo);
    if (
      !from ||
      !to ||
      to < from ||
      to.getTime() - from.getTime() > 62 * 86400000
    )
      return bad("invalid_range");
    const through = new Date(to.getTime() + 86400000);
    const [practitioner, rows] = await Promise.all([
      prisma.practitioner.findUnique({
        where: { id: practitionerId },
        select: { workingHours: true },
      }),
      prisma.availability.findMany({
        where: { practitionerId, date: { gte: from, lt: through } },
        select: { date: true, slots: true },
      }),
    ]);
    const workingHours = parseWorkingHours(practitioner?.workingHours);
    const byDate = new Map(
      rows.map((row) => [
        row.date.toISOString().slice(0, 10),
        normalizeSlots(row.slots),
      ]),
    );
    const dates: string[] = [];
    for (
      let cursor = new Date(from);
      cursor < through;
      cursor = new Date(cursor.getTime() + 86400000)
    ) {
      const date = ymdFromDate(cursor);
      const slots = byDate.get(date) ?? generateStaffSlots(date, workingHours);
      if (slots.some((slot) => slot.status === "open")) dates.push(date);
    }
    return NextResponse.json({ dates, workingHours });
  }
  const requestedDate = searchParams.get("date") ?? ymdFromDate(new Date());
  const date = dateFromYmd(requestedDate);
  if (!date) return bad("invalid_date");

  const [availability, practitioner] = await Promise.all([
    prisma.availability.findUnique({
      where: { practitionerId_date: { practitionerId, date } },
      select: { slots: true },
    }),
    prisma.practitioner.findUnique({
      where: { id: practitionerId },
      select: { workingHours: true },
    }),
  ]);
  const appointments = await prisma.appointment.findMany({
    where: {
      ...(searchParams.get("excludeId")
        ? { id: { not: searchParams.get("excludeId")! } }
        : {}),
      practitionerId,
      status: { not: "CANCELLED" },
      start: { lt: clinicDateBounds(requestedDate)!.end },
      end: { gt: clinicDateBounds(requestedDate)!.start },
    },
    orderBy: { start: "asc" },
    include: {
      client: { select: { fullName: true, phone: true, email: true } },
      service: { select: { slug: true } },
    },
  });

  const baseSlots = availability
    ? normalizeSlots(availability.slots)
    : generateStaffSlots(
        requestedDate,
        parseWorkingHours(practitioner?.workingHours),
      );

  return NextResponse.json({
    date: requestedDate,
    workingHours: parseWorkingHours(practitioner?.workingHours),
    slots: slotsWithBookedStatus(baseSlots, appointments),
    appointments: appointments.map((appt) => ({
      id: appt.id,
      start: appt.start.toISOString(),
      end: appt.end.toISOString(),
      status: appt.status,
      serviceSlug: appt.service.slug,
      procedureTitle: appt.procedureTitle,
      procedurePrice: appt.procedurePrice,
      clientName: appt.contactName,
      clientPhone: appt.contactPhone,
      clientEmail: appt.contactEmail,
      notes: appt.notes,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return forbidden();
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const dateStr = String(payload.date ?? "");
  const date = dateFromYmd(dateStr);
  if (!date) return bad("invalid_date");
  const practitionerId = await resolvePractitionerId(
    user,
    payload.practitionerId,
  );
  if (!practitionerId) return forbidden();

  const slots = normalizeSlots(payload.slots);
  const saved = await prisma.availability.upsert({
    where: { practitionerId_date: { practitionerId, date } },
    update: { slots },
    create: { practitionerId, date, slots },
    select: { date: true, slots: true },
  });

  return NextResponse.json({
    date: ymdFromDate(saved.date),
    slots: normalizeSlots(saved.slots),
  });
}

export async function PATCH(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return forbidden();
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) return bad("invalid_json");

  const action = String(payload.action ?? "");
  if (action === "add_workday" || action === "remove_workday") {
    return mutateWorkday(req, user, payload, action);
  }
  const startMinute = Number(payload.startMinute);
  const endMinute = Number(payload.endMinute);
  const rawTargets = Array.isArray(payload.targets) ? payload.targets : [];
  const targets = rawTargets.map((value) => {
    const target = value as Record<string, unknown>;
    return {
      date: String(target.date ?? ""),
      practitionerId: String(target.practitionerId ?? ""),
    };
  });
  if (
    !["open", "closed"].includes(action) ||
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > 1440 ||
    startMinute >= endMinute ||
    startMinute % 15 !== 0 ||
    endMinute % 15 !== 0 ||
    !targets.length ||
    targets.length > 64 ||
    targets.some(
      (target) => !dateFromYmd(target.date) || !target.practitionerId,
    ) ||
    new Set(targets.map((target) => `${target.date}:${target.practitionerId}`))
      .size !== targets.length
  )
    return bad("invalid_range");

  const now = new Date();
  if (
    targets.some((target) => {
      const start = dateFromYmd(target.date)!;
      start.setUTCMinutes(startMinute);
      return start <= now;
    })
  )
    return bad("start_in_past");

  const practitionerIds = [
    ...new Set(targets.map((target) => target.practitionerId)),
  ];
  const practitioners = await prisma.practitioner.findMany({
    where: { id: { in: practitionerIds }, active: true },
    select: { id: true, workingHours: true },
  });
  if (practitioners.length !== practitionerIds.length)
    return bad("invalid_employee");
  const practitionerById = new Map(
    practitioners.map((practitioner) => [practitioner.id, practitioner]),
  );
  const dates = targets.map((target) => dateFromYmd(target.date)!);
  const existing = await prisma.availability.findMany({
    where: {
      OR: targets.map((target, index) => ({
        practitionerId: target.practitionerId,
        date: dates[index],
      })),
    },
    select: { practitionerId: true, date: true, slots: true },
  });
  const existingByKey = new Map(
    existing.map((row) => [
      `${row.date.toISOString().slice(0, 10)}:${row.practitionerId}`,
      row.slots,
    ]),
  );

  await prisma.$transaction(
    targets.map((target, index) => {
      const practitioner = practitionerById.get(target.practitionerId)!;
      const base =
        existingByKey.get(`${target.date}:${target.practitionerId}`) ??
        generateStaffSlots(
          target.date,
          parseWorkingHours(practitioner.workingHours),
        );
      const slots = applyAvailabilityRange(
        base,
        target.date,
        startMinute,
        endMinute,
        action as "open" | "closed",
      );
      return prisma.availability.upsert({
        where: {
          practitionerId_date: {
            practitionerId: target.practitionerId,
            date: dates[index],
          },
        },
        update: { slots },
        create: {
          practitionerId: target.practitionerId,
          date: dates[index],
          slots,
        },
      });
    }),
  );
  await auditForUser(
    user,
    action === "open"
      ? "availability_range_opened"
      : "availability_range_closed",
    "Availability",
    null,
    {
      request: req,
      metadata: { startMinute, endMinute, targetCount: targets.length },
    },
  );
  return NextResponse.json({ changed: targets.length, action });
}

async function mutateWorkday(
  req: NextRequest,
  user: AuthUser,
  payload: Record<string, unknown>,
  action: "add_workday" | "remove_workday",
) {
  const dateStr = String(payload.date ?? "");
  const date = dateFromYmd(dateStr);
  if (!date || dateStr < clinicTodayYmd()) return bad("invalid_date");
  const practitionerId = await resolvePractitionerId(
    user,
    payload.practitionerId,
  );
  if (!practitionerId) return forbidden();
  const practitioner = await prisma.practitioner.findFirst({
    where: { id: practitionerId, active: true },
    select: { id: true },
  });
  if (!practitioner) return bad("invalid_employee");

  let startMinute = 0;
  let endMinute = 0;
  let slots: ReturnType<typeof workdaySlots> = [];
  if (action === "add_workday") {
    startMinute = Number(payload.startMinute);
    endMinute = Number(payload.endMinute);
    slots = workdaySlots(dateStr, startMinute, endMinute);
    if (!slots.length) return bad("invalid_range");
  }

  const bounds = clinicDateBounds(dateStr)!;
  const dayEnd = bounds.end;
  const rangeStart =
    clinicDateTimeToInstant(dateStr, minuteLabel(startMinute)) ?? bounds.start;
  const rangeEnd =
    clinicDateTimeToInstant(dateStr, minuteLabel(endMinute)) ?? bounds.end;
  const saved = await prisma
    .$transaction(async (tx) => {
      await lockReservationKeys(tx, {
        start: bounds.start,
        end: dayEnd,
        practitionerIds: [practitionerId],
      });
      const conflictingAppointment = await tx.appointment.findFirst({
        where: {
          practitionerId,
          status: { in: ["BOOKED", "CONFIRMED", "RESCHEDULED"] },
          start: { lt: dayEnd },
          end: { gt: date },
          ...(action === "add_workday"
            ? { OR: [{ start: { lt: rangeStart } }, { end: { gt: rangeEnd } }] }
            : {}),
        },
        select: { id: true },
      });
      if (conflictingAppointment) throw new Error("appointments_conflict");
      return tx.availability.upsert({
        where: { practitionerId_date: { practitionerId, date } },
        update: { slots },
        create: { practitionerId, date, slots },
        select: { id: true, date: true, slots: true },
      });
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "appointments_conflict")
        return null;
      throw error;
    });
  if (!saved) return bad("appointments_conflict");
  await auditForUser(
    user,
    action === "add_workday" ? "workday_added" : "workday_removed",
    "Availability",
    saved.id,
    {
      request: req,
      metadata: {
        practitionerId,
        date: dateStr,
        ...(action === "add_workday" ? { startMinute, endMinute } : {}),
      },
    },
  );
  return NextResponse.json({
    action,
    practitionerId,
    date: dateStr,
    slots: normalizeSlots(saved.slots),
  });
}

export async function PUT(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return forbidden();
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const fromDate = String(payload.fromDate ?? ymdFromDate(new Date()));
  const daysAhead = Math.min(90, Math.max(1, Number(payload.daysAhead ?? 30)));
  const start = dateFromYmd(fromDate);
  if (!start) return bad("invalid_date");
  const practitionerId = await resolvePractitionerId(
    user,
    payload.practitionerId,
  );
  if (!practitionerId) return forbidden();

  const hours = normalizeWorkingHours({
    intervals: payload.intervals,
    openDays: Array.isArray(payload.openDays)
      ? payload.openDays.map(Number)
      : undefined,
    startHour: Number(payload.startHour),
    endHour: Number(payload.endHour),
    stepMin: Number(payload.stepMin),
  });

  const lastDate = new Date(start);
  lastDate.setUTCDate(lastDate.getUTCDate() + daysAhead);
  const fromBounds = clinicDateBounds(fromDate)!;
  const toBounds = clinicDateBounds(ymdFromDate(lastDate))!;
  const futureAppointments = await prisma.appointment.findMany({
    where: {
      practitionerId,
      status: { in: ["BOOKED", "CONFIRMED", "RESCHEDULED"] },
      start: { gte: fromBounds.start, lt: toBounds.end },
    },
    select: { id: true, start: true, end: true },
  });
  const affected = futureAppointments.filter((appointment) => {
    const appointmentDate = clinicDateFromInstant(appointment.start);
    return !availabilityCovers(
      generateStaffSlots(appointmentDate, hours),
      appointment.start,
      appointment.end,
    );
  });
  if (affected.length)
    return NextResponse.json(
      {
        error: "appointments_conflict",
        affected: affected.length,
        appointmentIds: affected.slice(0, 20).map((item) => item.id),
      },
      { status: 409 },
    );

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.practitioner.update({
      where: { id: practitionerId },
      data: { workingHours: scheduleStorageValue(hours) },
    }),
  ];
  for (let i = 0; i <= daysAhead; i++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const dateStr = ymdFromDate(date);
    const slots = generateStaffSlots(dateStr, hours);
    writes.push(
      prisma.availability.upsert({
        where: { practitionerId_date: { practitionerId, date } },
        update: { slots },
        create: { practitionerId, date, slots },
      }),
    );
  }

  await prisma.$transaction(writes);

  return NextResponse.json({ changed: daysAhead + 1, workingHours: hours });
}
