import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  calendarUpdatedChanges,
  overlapsWhere,
  type CalendarConflict,
} from "@/lib/calendar-scheduling";
import {
  availabilityCovers,
  generateStaffSlots,
  parseWorkingHours,
} from "@/lib/staff-schedule";
import {
  notifyAppointmentChange,
  notifyAppointmentConfirmation,
} from "@/lib/notifications";
import { resolveProcedure } from "@/lib/procedures";
import { routing, type Locale } from "@/i18n/routing";
import { lockAndFindReservationConflict } from "@/lib/calendar-blocks";
import { normalizeInternationalPhone } from "@/lib/phone";
import { normalizeContactEmail } from "@/lib/contact-normalization";
import {
  clinicDateFromInstant,
  clinicTimeFromInstant,
} from "@/lib/clinic-time";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function conflict(error: CalendarConflict | string, status = 409) {
  return NextResponse.json({ error }, { status });
}

const include = {
  client: { select: { fullName: true, email: true, phone: true } },
  serviceOption: { select: { key: true } },
  practitioner: { select: { name: true, publicName: true } },
  service: {
    include: {
      contents: { select: { locale: true, status: true, whatItIs: true } },
      options: { include: { contents: true } },
      capabilities: {
        where: { practitioner: { active: true }, room: { active: true } },
        select: {
          practitionerId: true,
          roomId: true,
          devices: {
            where: { device: { active: true } },
            select: { deviceId: true },
          },
        },
      },
      rooms: { where: { active: true }, select: { id: true } },
      devices: { where: { active: true }, select: { id: true } },
    },
  },
} satisfies Prisma.AppointmentInclude;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return conflict("forbidden", 403);
  const { id } = await params;
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) return conflict("invalid_json", 400);
  const intent = String(payload.intent ?? "schedule");
  const expectedVersion = Number(payload.version);

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include,
  });
  if (!appointment) return conflict("not_found", 404);
  if (!Number.isSafeInteger(expectedVersion)) return conflict("stale");

  if (["confirm", "complete", "cancel"].includes(intent)) {
    return lifecycle({
      req,
      user,
      appointment,
      intent,
      expectedVersion,
      payload,
    });
  }
  if (!["schedule", "details"].includes(intent))
    return conflict("invalid_action", 400);
  if (!["BOOKED", "CONFIRMED", "RESCHEDULED"].includes(appointment.status))
    return conflict("not_movable");

  const locale = routing.locales.includes(payload.locale as Locale)
    ? (payload.locale as Locale)
    : (appointment.locale as Locale);
  const serviceId =
    intent === "details"
      ? String(payload.serviceId ?? appointment.serviceId)
      : appointment.serviceId;
  const service =
    serviceId === appointment.serviceId
      ? appointment.service
      : await prisma.service.findFirst({
          where: {
            id: serviceId,
            bookable: true,
            archivedAt: null,
            contents: { some: { locale, status: "PUBLISHED" } },
          },
          include: {
            contents: {
              select: { locale: true, status: true, whatItIs: true },
            },
            options: { include: { contents: true } },
            capabilities: {
              where: { practitioner: { active: true }, room: { active: true } },
              select: {
                practitionerId: true,
                roomId: true,
                devices: {
                  where: { device: { active: true } },
                  select: { deviceId: true },
                },
              },
            },
            rooms: { where: { active: true }, select: { id: true } },
            devices: { where: { active: true }, select: { id: true } },
          },
        });
  if (!service) return conflict("unknown_service", 400);
  const content = service.contents.find(
    (row) => row.locale === locale && row.status === "PUBLISHED",
  );
  if (!content) return conflict("unknown_service", 400);

  const start = new Date(
    String(payload.start ?? appointment.start.toISOString()),
  );
  if (Number.isNaN(start.getTime())) return conflict("invalid_time");
  if (start.getTime() <= Date.now()) return conflict("start_in_past");
  if (Number(clinicTimeFromInstant(start).slice(3)) % 15 !== 0)
    return conflict("invalid_time");
  const optionKey =
    intent === "details"
      ? String(payload.option ?? "")
      : (appointment.serviceOption?.key ?? "");
  const selectedOption = optionKey
    ? service.options.find(
        (item) =>
          item.key === optionKey &&
          (item.type === "APPOINTMENT" || item.type === "COURSE") &&
          item.bookable &&
          item.published &&
          !item.archivedAt,
      )
    : null;
  const selectedOptionContent = selectedOption?.contents.find(
    (item) => item.locale === locale && item.status === "PUBLISHED",
  );
  if (
    optionKey &&
    (!selectedOption ||
      !selectedOptionContent ||
      !selectedOption.bookingDurationMin)
  )
    return conflict("invalid_option", 400);
  const duration =
    intent === "details" && selectedOption?.bookingDurationMin
      ? selectedOption.bookingDurationMin * 60_000
      : serviceId === appointment.serviceId
        ? appointment.end.getTime() - appointment.start.getTime()
        : service.durationMin * 60_000;
  const end = new Date(start.getTime() + duration);
  const reservedUntil = new Date(end.getTime() + 10 * 60_000);
  const practitionerId = String(
    payload.practitionerId ?? appointment.practitionerId,
  );
  const dateStr = clinicDateFromInstant(start);
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const [availability, selectedPractitioner] = await Promise.all([
    prisma.availability.findUnique({
      where: { practitionerId_date: { practitionerId, date } },
      select: { slots: true },
    }),
    prisma.practitioner.findUnique({
      where: { id: practitionerId },
      select: { workingHours: true },
    }),
  ]);
  const coverage =
    availability?.slots ??
    generateStaffSlots(
      dateStr,
      parseWorkingHours(selectedPractitioner?.workingHours),
    );
  if (!availabilityCovers(coverage, start, reservedUntil))
    return conflict("outside_availability");

  const roomId = String(payload.roomId ?? appointment.roomId ?? "") || null;
  const deviceId =
    String(payload.deviceId ?? appointment.deviceId ?? "") || null;
  const qualificationOptionId =
    selectedOption?.id ?? appointment.serviceOptionId;
  if (
    qualificationOptionId &&
    !(await prisma.practitionerServiceOptionQualification.findUnique({
      where: {
        practitionerId_serviceOptionId: {
          practitionerId,
          serviceOptionId: qualificationOptionId,
        },
      },
      select: { id: true },
    }))
  )
    return conflict("invalid_capability");
  if (service.requiresDevice && !deviceId) return conflict("device_required");
  const capability = service.capabilities.find(
    (item) =>
      item.practitionerId === practitionerId &&
      item.roomId === roomId &&
      (deviceId === null ||
        item.devices.some((link) => link.deviceId === deviceId)),
  );
  if (!capability) return conflict("invalid_capability");

  const clientId =
    intent === "details"
      ? String(payload.clientId || appointment.clientId)
      : appointment.clientId;
  const client = await prisma.client.findFirst({
    where: { id: clientId, archivedAt: null },
    select: { id: true },
  });
  if (!client) return conflict("client_not_found", 404);
  const submittedContact = (payload.contact ?? {}) as Record<string, unknown>;
  const contactName =
    intent === "details"
      ? String(submittedContact.fullName ?? "")
          .trim()
          .slice(0, 160)
      : appointment.contactName;
  const contactEmail =
    intent === "details"
      ? String(submittedContact.email ?? "")
          .trim()
          .toLowerCase()
      : appointment.contactEmail;
  const contactPhone =
    intent === "details"
      ? normalizeInternationalPhone(String(submittedContact.phone ?? ""))
      : appointment.contactPhone;
  if (!contactName || !EMAIL_RE.test(contactEmail) || !contactPhone)
    return conflict("client_invalid", 400);
  const procedureRequested =
    intent === "details" &&
    payload.procedureIndex !== undefined &&
    payload.procedureIndex !== null &&
    payload.procedureIndex !== "";
  const procedure = procedureRequested
    ? resolveProcedure(content.whatItIs, payload.procedureIndex)
    : null;
  if (procedureRequested && !procedure)
    return conflict("invalid_procedure", 400);
  const procedureIndex =
    intent === "details"
      ? (selectedOption?.legacyProcedureIndex ?? procedure?.index ?? null)
      : appointment.procedureIndex;
  const procedureTitle =
    intent === "details"
      ? (selectedOptionContent?.name ?? procedure?.procedure.title ?? null)
      : appointment.procedureTitle;
  const procedurePrice =
    intent === "details"
      ? (selectedOptionContent?.priceLabel ??
        procedure?.procedure.price ??
        null)
      : appointment.procedurePrice;
  const notes =
    intent === "details"
      ? String(payload.notes ?? "")
          .trim()
          .slice(0, 2000) || null
      : appointment.notes;

  const baseOverlap = overlapsWhere(start, end, id);
  const [employeeOverlap, roomOverlap, deviceOverlap] = await Promise.all([
    prisma.appointment.findFirst({
      where: { ...baseOverlap, practitionerId },
      select: { id: true },
    }),
    prisma.appointment.findFirst({
      where: { ...baseOverlap, roomId },
      select: { id: true },
    }),
    deviceId
      ? prisma.appointment.findFirst({
          where: { ...baseOverlap, deviceId },
          select: { id: true },
        })
      : null,
  ]);
  if (employeeOverlap) return conflict("employee_overlap");
  if (roomOverlap) return conflict("room_overlap");
  if (deviceOverlap) return conflict("device_overlap");

  const previous = {
    start: appointment.start,
    end: appointment.end,
    practitionerId: appointment.practitionerId,
    roomId: appointment.roomId,
    deviceId: appointment.deviceId,
  };
  const next = { start, end, practitionerId, roomId, deviceId };
  const detailChanges = {
    previous: {
      clientId: appointment.clientId,
      serviceId: appointment.serviceId,
      procedureIndex: appointment.procedureIndex,
      notes: appointment.notes,
      locale: appointment.locale,
      contactChanged: false,
    },
    next: {
      clientId,
      serviceId,
      procedureIndex,
      notes,
      locale,
      contactChanged:
        appointment.contactName !== contactName ||
        appointment.contactEmail !== contactEmail ||
        appointment.contactPhone !== contactPhone,
    },
  };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const reservationConflict = await lockAndFindReservationConflict(tx, {
        start,
        end: reservedUntil,
        practitionerIds: [practitionerId],
        roomId,
        deviceId,
        excludeAppointmentId: id,
      });
      if (reservationConflict) throw new Error("reservation_conflict");
      const changed = await tx.appointment.updateMany({
        where: { id, version: expectedVersion },
        data: {
          ...next,
          bufferMinutes: 10,
          reservedUntil,
          bufferEnforced: true,
          clientId,
          contactName,
          contactEmail,
          contactPhone,
          normalizedContactEmail: normalizeContactEmail(contactEmail),
          normalizedContactPhone: contactPhone,
          serviceId,
          procedureIndex,
          procedureTitle,
          procedurePrice,
          serviceOptionId:
            selectedOption?.id ??
            (intent === "details" ? null : appointment.serviceOptionId),
          bookingDurationMin: Math.round(duration / 60_000),
          notes,
          locale,
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw new Error("stale");
      await tx.appointmentEvent.create({
        data: {
          appointmentId: id,
          kind: intent === "details" ? "DETAILS_UPDATED" : "CALENDAR_UPDATED",
          actor: user.email,
          previousStatus: appointment.status,
          nextStatus: appointment.status,
          previousStart: appointment.start,
          previousEnd: appointment.end,
          nextStart: start,
          nextEnd: end,
          changes:
            intent === "details"
              ? detailChanges
              : calendarUpdatedChanges({ previous, next }),
        },
      });
      return tx.appointment.findUniqueOrThrow({
        where: { id },
        include: {
          client: { select: { fullName: true, email: true, phone: true } },
          service: { select: { slug: true } },
        },
      });
    });
    await auditForUser(
      user,
      intent === "details"
        ? "appointment_details_updated"
        : "appointment_calendar_updated",
      "Appointment",
      id,
      { request: req },
    );
    const scheduleChanged =
      previous.start.getTime() !== start.getTime() ||
      previous.practitionerId !== practitionerId;
    const materialDetailsChanged =
      appointment.serviceId !== serviceId ||
      appointment.procedureIndex !== procedureIndex ||
      appointment.clientId !== clientId ||
      appointment.contactName !== contactName ||
      appointment.contactEmail !== contactEmail ||
      appointment.contactPhone !== contactPhone;
    if (scheduleChanged || materialDetailsChanged) {
      await notifyAppointmentChange(
        updated,
        "rescheduled",
        updated.locale as Locale,
        null,
        user.email,
        `v${updated.version}`,
      );
    }
    return NextResponse.json({
      id: updated.id,
      version: updated.version,
      status: updated.status,
      start: updated.start.toISOString(),
      end: updated.end.toISOString(),
      practitionerId: updated.practitionerId,
      roomId: updated.roomId,
      deviceId: updated.deviceId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "stale")
      return conflict("stale");
    if (error instanceof Error && error.message === "reservation_conflict")
      return conflict("employee_overlap");
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      return conflict("stale");
    throw error;
  }
}

async function lifecycle({
  req,
  user,
  appointment,
  intent,
  expectedVersion,
  payload,
}: {
  req: NextRequest;
  user: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>;
  appointment: Prisma.AppointmentGetPayload<{ include: typeof include }>;
  intent: string;
  expectedVersion: number;
  payload: Record<string, unknown>;
}) {
  const now = new Date();
  let nextStatus: "CONFIRMED" | "COMPLETED" | "CANCELLED";
  if (intent === "confirm") {
    if (!["BOOKED", "RESCHEDULED"].includes(appointment.status))
      return conflict("invalid_status");
    nextStatus = "CONFIRMED";
  } else if (intent === "complete") {
    if (appointment.status !== "CONFIRMED" || appointment.end > now)
      return conflict("invalid_status");
    nextStatus = "COMPLETED";
  } else {
    if (!["BOOKED", "CONFIRMED", "RESCHEDULED"].includes(appointment.status))
      return conflict("invalid_status");
    nextStatus = "CANCELLED";
  }
  const reason = String(payload.reason ?? "")
    .trim()
    .slice(0, 500);
  if (nextStatus === "CANCELLED" && reason.length < 3)
    return conflict("reason_required", 400);

  const eventKind =
    nextStatus === "CONFIRMED"
      ? "CONFIRMED"
      : nextStatus === "COMPLETED"
        ? "COMPLETED"
        : "CANCELLED";
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.appointment.updateMany({
        where: { id: appointment.id, version: expectedVersion },
        data: {
          status: nextStatus,
          version: { increment: 1 },
          ...(nextStatus === "CONFIRMED" ? { confirmedAt: now } : {}),
          ...(nextStatus === "COMPLETED" ? { completedAt: now } : {}),
          ...(nextStatus === "CANCELLED"
            ? { cancelledAt: now, cancellationReason: reason }
            : {}),
        },
      });
      if (!changed.count) throw new Error("stale");
      await tx.appointmentEvent.create({
        data: {
          appointmentId: appointment.id,
          kind: eventKind,
          actor: user.email,
          previousStatus: appointment.status,
          nextStatus,
          reason: reason || null,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "stale")
      return conflict("stale");
    throw error;
  }
  await auditForUser(
    user,
    `appointment_${nextStatus.toLowerCase()}`,
    "Appointment",
    appointment.id,
    { request: req },
  );
  const notificationAppointment = {
    ...appointment,
    status: nextStatus,
    version: expectedVersion + 1,
  };
  if (nextStatus === "CONFIRMED")
    await notifyAppointmentConfirmation(
      notificationAppointment,
      appointment.locale as Locale,
      user.email,
    );
  if (nextStatus === "CANCELLED")
    await notifyAppointmentChange(
      notificationAppointment,
      "cancellation",
      appointment.locale as Locale,
      reason,
      user.email,
      `v${expectedVersion + 1}`,
    );
  return NextResponse.json({
    id: appointment.id,
    version: expectedVersion + 1,
    status: nextStatus,
  });
}
