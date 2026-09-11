import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  generateStaffSlots,
  normalizeSlots,
  parseWorkingHours,
} from "@/lib/staff-schedule";
import { staffPractitionerId } from "@/lib/calendar-scheduling";
import { INTERNAL_CALENDAR_SERVICE_BY_KEY } from "@/lib/internal-calendar-services";
import { clinicDateBounds } from "@/lib/clinic-time";

export async function GET(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const locale = ["fi", "en", "ru"].includes(params.get("locale") ?? "")
    ? (params.get("locale") as "fi" | "en" | "ru")
    : "fi";
  const fromParam = String(params.get("from") ?? "");
  const toParam = String(params.get("to") ?? "");
  const fromBounds = clinicDateBounds(fromParam.slice(0, 10));
  const toBounds = clinicDateBounds(toParam.slice(0, 10));
  const from = fromBounds?.start ?? new Date(NaN);
  const to = toBounds?.start ?? new Date(NaN);
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to <= from ||
    to.getTime() - from.getTime() > 43 * 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  const ownPractitionerId = await staffPractitionerId(user);
  const practitionerWhere = { active: true };
  const [
    practitioners,
    rooms,
    devices,
    availabilities,
    appointments,
    templates,
    blocks,
  ] = await Promise.all([
    prisma.practitioner.findMany({
      where: practitionerWhere,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        calendarColor: true,
        workingHours: true,
      },
    }),
    prisma.room.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.device.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.availability.findMany({
      where: {
        date: { gte: from, lt: to },
        practitioner: practitionerWhere,
      },
      select: { practitionerId: true, date: true, slots: true },
    }),
    prisma.appointment.findMany({
      where: {
        status: { not: "CANCELLED" },
        start: { lt: to },
        end: { gt: from },
        practitioner: practitionerWhere,
      },
      orderBy: { start: "asc" },
      include: {
        client: { select: { fullName: true } },
        service: {
          select: {
            slug: true,
            contents: {
              where: { locale, status: "PUBLISHED" },
              select: { h1: true },
              take: 1,
            },
            primaryPractitionerId: true,
            capabilities: {
              select: {
                practitionerId: true,
                roomId: true,
                devices: { select: { deviceId: true } },
              },
            },
            rooms: { where: { active: true }, select: { id: true } },
            devices: { where: { active: true }, select: { id: true } },
            requiresDevice: true,
          },
        },
        room: { select: { id: true, name: true, active: true } },
        device: { select: { id: true, name: true, active: true } },
      },
    }),
    prisma.calendarBlockTemplate.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
    }),
    prisma.calendarBlock.findMany({
      where: {
        status: "ACTIVE",
        start: { lt: to },
        end: { gt: from },
        participants: { some: { practitioner: practitionerWhere } },
      },
      orderBy: { start: "asc" },
      include: {
        participants: { select: { practitionerId: true } },
        items: { orderBy: { displayOrder: "asc" } },
        room: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
      },
    }),
  ]);

  const normalizedPractitioners = practitioners.map((practitioner) => ({
    ...practitioner,
    workingHours: parseWorkingHours(practitioner.workingHours),
  }));
  const availabilityByKey = new Map(
    availabilities.map((row) => [
      `${row.practitionerId}:${row.date.toISOString().slice(0, 10)}`,
      normalizeSlots(row.slots),
    ]),
  );
  const calendarDays: string[] = [];
  for (
    let cursor = new Date(from);
    cursor < to;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    calendarDays.push(cursor.toISOString().slice(0, 10));
  }

  return NextResponse.json({
    viewerId: user.id,
    practitioners: normalizedPractitioners,
    rooms,
    devices,
    ownPractitionerId,
    canManageTemplates: true,
    canManageAppointments: true,
    canEditAllAvailability: true,
    canEditOwnAvailability: Boolean(ownPractitionerId),
    availabilities: normalizedPractitioners.flatMap((practitioner) =>
      calendarDays.map((date) => ({
        practitionerId: practitioner.id,
        date,
        slots:
          availabilityByKey.get(`${practitioner.id}:${date}`) ??
          generateStaffSlots(date, practitioner.workingHours),
      })),
    ),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      version: appointment.version,
      practitionerId: appointment.practitionerId,
      start: appointment.start.toISOString(),
      end: appointment.end.toISOString(),
      reservedUntil: appointment.reservedUntil?.toISOString() ?? null,
      bufferMinutes: appointment.bufferMinutes,
      status: appointment.status,
      channel: appointment.channel,
      channelLabel:
        appointment.channel === "web"
          ? locale === "fi"
            ? "Verkkosivusto"
            : locale === "ru"
              ? "Сайт"
              : "Website"
          : null,
      clientName: appointment.contactName,
      procedure:
        appointment.procedureTitle ??
        appointment.service.contents[0]?.h1 ??
        appointment.service.slug,
      room: appointment.room,
      device: appointment.device,
      roomId: appointment.roomId,
      deviceId: appointment.deviceId,
      resourceWarning: [appointment.room, appointment.device]
        .filter((resource): resource is NonNullable<typeof resource> =>
          Boolean(resource && !resource.active),
        )
        .map((resource) => resource.name),
      qualifiedPractitionerIds: Array.from(
        new Set(
          appointment.service.capabilities.map((item) => item.practitionerId),
        ),
      ),
      allowedRoomIds: Array.from(
        new Set(appointment.service.capabilities.map((item) => item.roomId)),
      ),
      allowedDeviceIds: Array.from(
        new Set(
          appointment.service.capabilities.flatMap((item) =>
            item.devices.map((link) => link.deviceId),
          ),
        ),
      ),
      capabilities: appointment.service.capabilities.map((item) => ({
        practitionerId: item.practitionerId,
        roomId: item.roomId,
        deviceIds: item.devices.map((link) => link.deviceId),
      })),
      requiresDevice: appointment.service.requiresDevice,
      editable: ["BOOKED", "CONFIRMED", "RESCHEDULED"].includes(
        appointment.status,
      ),
      bookingGroupId: appointment.bookingGroupId,
      bookingGroupIndex: appointment.bookingGroupIndex,
      bookingGroupCount: appointment.bookingGroupCount,
    })),
    templates: templates.map((template) => {
      const catalogEntry = INTERNAL_CALENDAR_SERVICE_BY_KEY.get(template.key);
      const dragLabels = catalogEntry?.dragLabels ?? {
        fi: Array.from(template.labelFi).slice(0, 14).join(""),
        en: Array.from(template.labelEn).slice(0, 14).join(""),
        ru: Array.from(template.labelRu).slice(0, 14).join(""),
      };
      return {
        id: template.id,
        key: template.key,
        label:
          locale === "fi"
            ? template.labelFi
            : locale === "ru"
              ? template.labelRu
              : template.labelEn,
        labels: {
          fi: template.labelFi,
          en: template.labelEn,
          ru: template.labelRu,
        },
        dragLabel: dragLabels[locale],
        dragLabels,
        defaultEnabled: catalogEntry?.defaultEnabled ?? false,
        defaultDurationMin: template.defaultDurationMin,
        color: template.color,
        displayOrder: template.displayOrder,
      };
    }),
    blocks: blocks.map((block) => ({
      id: block.id,
      seriesId: block.seriesId,
      version: block.version,
      start: block.start.toISOString(),
      end: block.end.toISOString(),
      notes: block.notes,
      roomId: block.roomId,
      deviceId: block.deviceId,
      room: block.room,
      device: block.device,
      practitionerIds: block.participants.map(
        (participant) => participant.practitionerId,
      ),
      items: block.items.map((item) => ({
        templateId: item.templateId,
        durationMin: item.durationMin,
        label:
          locale === "fi"
            ? item.labelFi
            : locale === "ru"
              ? item.labelRu
              : item.labelEn,
      })),
    })),
  });
}
