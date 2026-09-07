import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiUser, auditForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  availabilityCovers,
  generateStaffSlots,
  parseWorkingHours,
} from "@/lib/staff-schedule";
import { normalizeInternationalPhone } from "@/lib/phone";
import { normalizeContactEmail } from "@/lib/contact-normalization";
import { resolveProcedure } from "@/lib/procedures";
import { notifyAppointmentConfirmation } from "@/lib/notifications";
import { createAppointmentClaimUrl } from "@/lib/appointment-claim";
import { routing, type Locale } from "@/i18n/routing";
import { lockAndFindReservationConflict } from "@/lib/calendar-blocks";
import {
  clinicDateFromInstant,
  clinicTimeFromInstant,
} from "@/lib/clinic-time";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function localeFrom(value: unknown): Locale {
  return routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
}

export async function GET(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return bad("forbidden", 403);
  const locale = localeFrom(req.nextUrl.searchParams.get("locale"));
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);

  const [services, practitioners, rooms, devices, clients] = await Promise.all([
    prisma.service.findMany({
      where: {
        bookable: true,
        archivedAt: null,
        contents: { some: { locale, status: "PUBLISHED" } },
      },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      include: {
        contents: {
          where: { locale, status: "PUBLISHED" },
          take: 1,
          select: { h1: true, whatItIs: true },
        },
        options: {
          where: {
            archivedAt: null,
            published: true,
            type: { in: ["APPOINTMENT", "COURSE"] },
            bookable: true,
          },
          orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
          include: {
            contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
          },
        },
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
    }),
    prisma.practitioner.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, workingHours: true },
    }),
    prisma.room.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.device.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    q.length === 0 || q.length >= 2
      ? prisma.client.findMany({
          where: {
            archivedAt: null,
            ...(q.length >= 2
              ? {
                  OR: [
                    { fullName: { contains: q, mode: "insensitive" as const } },
                    { email: { contains: q, mode: "insensitive" as const } },
                    { phone: { contains: q } },
                  ],
                }
              : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, fullName: true, phone: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    services: services.map((service) => ({
      id: service.id,
      slug: service.slug,
      title: service.contents[0]?.h1 ?? service.slug,
      durationMin: service.durationMin,
      requiresDevice: service.requiresDevice,
      qualifiedPractitionerIds: Array.from(
        new Set(service.capabilities.map((item) => item.practitionerId)),
      ),
      roomIds: Array.from(
        new Set(service.capabilities.map((item) => item.roomId)),
      ),
      deviceIds: Array.from(
        new Set(
          service.capabilities.flatMap((item) =>
            item.devices.map((link) => link.deviceId),
          ),
        ),
      ),
      capabilities: service.capabilities.map((item) => ({
        practitionerId: item.practitionerId,
        roomId: item.roomId,
        deviceIds: item.devices.map((link) => link.deviceId),
      })),
      procedures: service.options.flatMap((option) =>
        option.contents[0]
          ? [
              {
                key: option.key,
                index: option.legacyProcedureIndex,
                title: option.contents[0].name,
                price: option.contents[0].priceLabel ?? "",
                durationMin: option.bookingDurationMin,
              },
            ]
          : [],
      ),
    })),
    practitioners: practitioners.map((practitioner) => ({
      ...practitioner,
      workingHours: parseWorkingHours(practitioner.workingHours),
    })),
    rooms,
    devices,
    clients,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return bad("forbidden", 403);
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) return bad("invalid_json");
  if (payload.consentGdpr !== true) return bad("consent_required");

  const locale = localeFrom(payload.locale);
  const start = new Date(String(payload.start ?? ""));
  if (Number.isNaN(start.getTime())) return bad("invalid_time");
  if (start.getTime() <= Date.now()) return bad("start_in_past");
  if (Number(clinicTimeFromInstant(start).slice(3)) % 15 !== 0)
    return bad("invalid_time");

  const service = await prisma.service.findFirst({
    where: {
      id: String(payload.serviceId ?? ""),
      bookable: true,
      archivedAt: null,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    include: {
      contents: {
        where: { locale, status: "PUBLISHED" },
        take: 1,
        select: { whatItIs: true },
      },
      options: {
        where: {
          key: String(payload.option ?? ""),
          archivedAt: null,
          published: true,
          type: { in: ["APPOINTMENT", "COURSE"] },
          bookable: true,
          contents: { some: { locale, status: "PUBLISHED" } },
        },
        include: {
          contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
        },
        take: 1,
      },
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
  if (!service) return bad("unknown_service");
  const selectedOption = service.options[0] ?? null;
  const selectedOptionContent = selectedOption?.contents[0] ?? null;
  if (payload.option && (!selectedOption || !selectedOptionContent))
    return bad("invalid_option");

  const practitionerId = String(payload.practitionerId ?? "");
  const roomId = String(payload.roomId ?? "");
  const deviceId = String(payload.deviceId ?? "") || null;
  const capability = service.capabilities.find(
    (item) =>
      item.practitionerId === practitionerId &&
      item.roomId === roomId &&
      (deviceId === null ||
        item.devices.some((link) => link.deviceId === deviceId)),
  );
  if (!capability) return bad("invalid_capability", 409);
  if (service.requiresDevice && !deviceId) return bad("device_required", 409);
  if (
    selectedOption &&
    !(await prisma.practitionerServiceOptionQualification.findUnique({
      where: {
        practitionerId_serviceOptionId: {
          practitionerId,
          serviceOptionId: selectedOption.id,
        },
      },
      select: { practitionerId: true },
    }))
  )
    return bad("specialist_not_qualified", 409);

  const procedureRequested =
    payload.procedureIndex !== undefined && payload.procedureIndex !== null;
  const procedure = procedureRequested
    ? resolveProcedure(
        service.contents[0]?.whatItIs ?? "",
        payload.procedureIndex,
      )
    : null;
  if (procedureRequested && !procedure) return bad("invalid_procedure");
  const requestedDuration =
    payload.durationMin === undefined
      ? (selectedOption?.bookingDurationMin ?? service.durationMin)
      : Number(payload.durationMin);
  if (
    !Number.isInteger(requestedDuration) ||
    requestedDuration < 15 ||
    requestedDuration > 12 * 60 ||
    requestedDuration % 15 !== 0
  )
    return bad("invalid_duration");
  const end = new Date(start.getTime() + requestedDuration * 60_000);
  const reservedEnd = new Date(end.getTime() + 15 * 60_000);
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
  if (!availabilityCovers(coverage, start, reservedEnd))
    return bad("outside_availability", 409);

  const clash = await prisma.appointment.findFirst({
    where: {
      status: { not: "CANCELLED" },
      start: { lt: reservedEnd },
      OR: [
        { reservedUntil: { gt: start } },
        { reservedUntil: null, end: { gt: start } },
      ],
      AND: [
        {
          OR: [
            { practitionerId },
            { roomId },
            ...(deviceId ? [{ deviceId }] : []),
          ],
        },
      ],
    },
    select: { id: true },
  });
  if (clash) return bad("slot_taken", 409);

  const existingClientId = String(payload.clientId ?? "");
  const contact = (payload.contact ?? payload.newClient ?? {}) as Record<
    string,
    unknown
  >;
  const fullName = String(contact.fullName ?? "")
    .trim()
    .slice(0, 160);
  const email = String(contact.email ?? "")
    .trim()
    .toLowerCase();
  const phone = normalizeInternationalPhone(String(contact.phone ?? ""));
  if (!fullName || !EMAIL_RE.test(email) || !phone)
    return bad("client_invalid");
  const notes =
    String(payload.notes ?? "")
      .trim()
      .slice(0, 2000) || null;

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const reservedUntil = reservedEnd;
      if (
        selectedOption &&
        !(await tx.practitionerServiceOptionQualification.findUnique({
          where: {
            practitionerId_serviceOptionId: {
              practitionerId,
              serviceOptionId: selectedOption.id,
            },
          },
          select: { practitionerId: true },
        }))
      )
        throw new Error("specialist_not_qualified");
      const reservationConflict = await lockAndFindReservationConflict(tx, {
        start,
        end: reservedUntil,
        practitionerIds: [practitionerId],
        roomId,
        deviceId,
      });
      if (reservationConflict) throw new Error("slot_taken");
      let client = existingClientId
        ? await tx.client.findFirst({
            where: { id: existingClientId, archivedAt: null },
          })
        : null;
      if (!client && existingClientId) throw new Error("client_not_found");
      if (!client) {
        client = await tx.client.findFirst({
          where: {
            archivedAt: null,
            OR: [{ email }, { phone: phone! }],
          },
        });
      }
      if (client) {
        client = await tx.client.update({
          where: { id: client.id },
          data: { consentGdpr: true },
        });
      } else {
        client = await tx.client.create({
          data: { fullName, email, phone: phone!, consentGdpr: true },
        });
      }
      await tx.consent.create({
        data: {
          clientId: client.id,
          type: "gdpr_booking_staff",
          granted: true,
        },
      });
      const created = await tx.appointment.create({
        data: {
          clientId: client.id,
          contactName: fullName,
          contactEmail: email,
          contactPhone: phone,
          normalizedContactEmail: normalizeContactEmail(email),
          normalizedContactPhone: phone,
          serviceId: service.id,
          practitionerId,
          roomId,
          deviceId,
          locale,
          start,
          end,
          bufferMinutes: 15,
          reservedUntil,
          bufferEnforced: true,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          channel: "staff",
          notes,
          procedureIndex: procedure?.index ?? null,
          procedureTitle:
            selectedOptionContent?.name ?? procedure?.procedure.title ?? null,
          procedurePrice:
            selectedOptionContent?.priceLabel ??
            procedure?.procedure.price ??
            null,
          serviceOptionId: selectedOption?.id ?? null,
          bookingDurationMin: requestedDuration,
        },
        include: {
          client: {
            select: { fullName: true, email: true, phone: true, userId: true },
          },
          service: { select: { slug: true } },
          practitioner: { select: { name: true, publicName: true } },
        },
      });
      await tx.appointmentEvent.create({
        data: {
          appointmentId: created.id,
          kind: "CREATED",
          actor: user.email,
          nextStatus: "CONFIRMED",
          nextStart: start,
          nextEnd: end,
          changes: {
            channel: "staff",
            practitionerId,
            roomId,
            deviceId,
            durationMin: requestedDuration,
          },
        },
      });
      return created;
    });

    await auditForUser(
      user,
      "appointment_created",
      "Appointment",
      appointment.id,
      {
        request: req,
      },
    );
    // The claim link rides inside the localized appointment email as a secondary CTA rather
    // than a second, English-only message of its own.
    let claimUrl: string | undefined;
    if (!appointment.client.userId) {
      try {
        claimUrl = await createAppointmentClaimUrl(
          {
            appointmentId: appointment.id,
            email: appointment.contactEmail,
          },
          locale,
        );
      } catch {
        await auditForUser(
          user,
          "appointment_claim_link_failed",
          "Appointment",
          appointment.id,
          { outcome: "FAILURE", request: req },
        );
      }
    }
    try {
      await notifyAppointmentConfirmation(
        { ...appointment, claimUrl },
        locale,
        user.email,
      );
    } catch {
      await auditForUser(
        user,
        "appointment_confirmation_unhandled_error",
        "Appointment",
        appointment.id,
        { outcome: "FAILURE", request: req },
      );
    }
    return NextResponse.json({
      id: appointment.id,
      status: appointment.status,
      start: appointment.start.toISOString(),
      end: appointment.end.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "client_not_found")
      return bad("client_not_found", 404);
    if (error instanceof Error && error.message === "specialist_not_qualified")
      return bad("specialist_not_qualified", 409);
    if (error instanceof Error && error.message === "slot_taken")
      return bad("slot_taken", 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      return bad("slot_taken", 409);
    throw error;
  }
}
