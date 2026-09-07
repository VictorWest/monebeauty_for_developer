import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  RESOURCE_POOLS,
  resourcePool,
  setResourcePoolCount,
  type ResourceKind,
} from "@/lib/resource-capacity";

function bad(error: string, status = 400, detail?: unknown) {
  return NextResponse.json({ error, detail }, { status });
}

const activeAppointmentWhere = {
  start: { gte: new Date() },
  status: { in: ["BOOKED", "CONFIRMED", "RESCHEDULED"] },
} satisfies Prisma.AppointmentWhereInput;

async function admin() {
  return requireApiUser(["ADMIN", "STAFF"]);
}

export async function GET() {
  if (!(await admin()))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [rooms, devices, services, templates] = await Promise.all([
    prisma.room.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.device.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.service.findMany({
      where: { archivedAt: null },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      include: {
        contents: {
          where: { locale: "fi" },
          select: { h1: true },
          take: 1,
        },
        capabilities: {
          select: { id: true, devices: { select: { deviceId: true } } },
        },
        rooms: { select: { id: true } },
        devices: { select: { id: true } },
      },
    }),
    prisma.calendarBlockTemplate.findMany({
      orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
    }),
  ]);
  return NextResponse.json({
    rooms,
    devices,
    resourcePools: RESOURCE_POOLS.map((pool) => {
      const units = (pool.kind === "room" ? rooms : devices).filter(
        (resource) => resource.poolKey === pool.key,
      );
      return {
        kind: pool.kind,
        key: pool.key,
        label: pool.label,
        activeCount: units.filter((unit) => unit.active).length,
        totalCount: units.length,
      };
    }),
    templates,
    services: services.map((service) => ({
      id: service.id,
      slug: service.slug,
      name: service.contents[0]?.h1 ?? service.slug,
      bookable: service.bookable,
      roomIds: service.rooms.map((item) => item.id),
      deviceIds: service.devices.map((item) => item.id),
      requiresDevice: service.requiresDevice,
      schedulingReady:
        service.capabilities.some(
          (capability) =>
            !service.requiresDevice || capability.devices.length > 0,
        ) &&
        service.rooms.length > 0 &&
        (!service.requiresDevice || service.devices.length > 0),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) return bad("invalid_json");
  const action = String(payload.action ?? "");

  if (action === "saveBlockTemplate") {
    const id = String(payload.id ?? "");
    const labelFi = String(payload.labelFi ?? "")
      .trim()
      .slice(0, 80);
    const labelEn = String(payload.labelEn ?? "")
      .trim()
      .slice(0, 80);
    const labelRu = String(payload.labelRu ?? "")
      .trim()
      .slice(0, 80);
    const color = String(payload.color ?? "#B89B72");
    const defaultDurationMin = Number(payload.defaultDurationMin);
    if (
      !id ||
      !labelFi ||
      !labelEn ||
      !labelRu ||
      !/^#[0-9A-F]{6}$/i.test(color) ||
      !Number.isInteger(defaultDurationMin) ||
      defaultDurationMin < 15 ||
      defaultDurationMin > 1440 ||
      defaultDurationMin % 15
    )
      return bad("invalid_template");
    const row = await prisma.calendarBlockTemplate.update({
      where: { id },
      data: {
        labelFi,
        labelEn,
        labelRu,
        color,
        defaultDurationMin,
        active: payload.active !== false,
        displayOrder: Math.round(Number(payload.displayOrder) || 0),
      },
    });
    await prisma.auditLog.create({
      data: {
        actor: user.email,
        actorUserId: user.id,
        actorRole: user.role,
        action: "calendar_block_template_updated",
        entity: "CalendarBlockTemplate",
        entityId: row.id,
      },
    });
    return NextResponse.json({ id: row.id });
  }

  if (action === "setResourceCount") {
    const kind = String(payload.kind ?? "") as ResourceKind;
    const poolKey = String(payload.poolKey ?? "");
    const count = Number(payload.count);
    if (!resourcePool(kind, poolKey) || !Number.isInteger(count)) {
      return bad("invalid_resource_count");
    }
    try {
      const appointmentIds = await prisma.$transaction(async (tx) => {
        const affected = await setResourcePoolCount(tx, kind, poolKey, count);
        await tx.auditLog.create({
          data: {
            actor: user.email,
            actorUserId: user.id,
            actorRole: user.role,
            action: "calendar_resource_count_updated",
            entity: kind === "room" ? "Room" : "Device",
            entityId: poolKey,
            metadata: { poolKey, count, affectedAppointmentIds: affected },
          },
        });
        return affected;
      });
      return NextResponse.json({
        poolKey,
        count,
        warning: appointmentIds.length
          ? {
              affected: appointmentIds.length,
              appointmentIds: appointmentIds.slice(0, 20),
            }
          : null,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        ["invalid_resource_count", "resource_pool_missing"].includes(
          error.message,
        )
      ) {
        return bad(error.message);
      }
      throw error;
    }
  }

  if (action === "saveRoom" || action === "saveDevice") {
    const id = String(payload.id ?? "");
    const name = String(payload.name ?? "").trim();
    if (!name) return bad("name_required");
    const affected =
      id && payload.active === false
        ? await prisma.appointment.findMany({
            where: {
              ...activeAppointmentWhere,
              ...(action === "saveRoom" ? { roomId: id } : { deviceId: id }),
            },
            orderBy: { start: "asc" },
            select: { id: true },
          })
        : [];
    const data = {
      name,
      displayOrder: Math.round(Number(payload.displayOrder) || 0),
      active: payload.active !== false,
    };
    const delegate = action === "saveRoom" ? prisma.room : prisma.device;
    const row = id
      ? await (delegate.update as typeof prisma.room.update)({
          where: { id },
          data,
        })
      : await (delegate.create as typeof prisma.room.create)({ data });
    await prisma.auditLog.create({
      data: {
        actor: user.email,
        action:
          action === "saveRoom"
            ? "calendar_room_saved"
            : "calendar_device_saved",
        entity: action === "saveRoom" ? "Room" : "Device",
        entityId: row.id,
      },
    });
    return NextResponse.json({
      id: row.id,
      warning: affected.length
        ? {
            affected: affected.length,
            appointmentIds: affected.slice(0, 20).map((item) => item.id),
          }
        : null,
    });
  }

  if (action === "configureService") {
    const serviceId = String(payload.serviceId ?? "");
    const ids = (key: string) =>
      Array.isArray(payload[key])
        ? (payload[key] as unknown[]).map(String).filter(Boolean)
        : [];
    const roomIds = ids("roomIds");
    const deviceIds = ids("deviceIds");
    const [validRooms, validDevices, future, capabilities] = await Promise.all([
      prisma.room.count({ where: { id: { in: roomIds }, active: true } }),
      prisma.device.count({
        where: { id: { in: deviceIds }, active: true },
      }),
      prisma.appointment.findMany({
        where: { ...activeAppointmentWhere, serviceId },
        select: {
          id: true,
          practitionerId: true,
          roomId: true,
          deviceId: true,
        },
      }),
      prisma.practitionerServiceCapability.findMany({
        where: { serviceId },
        select: {
          roomId: true,
          devices: { select: { deviceId: true } },
        },
      }),
    ]);
    if (
      validRooms !== new Set(roomIds).size ||
      validDevices !== new Set(deviceIds).size
    )
      return bad("invalid_resource");
    const affected = future.filter(
      (appointment) =>
        !appointment.roomId ||
        !roomIds.includes(appointment.roomId) ||
        (appointment.deviceId !== null &&
          !deviceIds.includes(appointment.deviceId)),
    );
    if (affected.length)
      return bad("future_appointments", 409, {
        affected: affected.length,
        appointmentIds: affected.slice(0, 20).map((item) => item.id),
      });
    const invalidCapabilities = capabilities.filter(
      (capability) =>
        !roomIds.includes(capability.roomId) ||
        capability.devices.some((link) => !deviceIds.includes(link.deviceId)),
    );
    if (invalidCapabilities.length)
      return bad("employee_capabilities_use_resource", 409, {
        affected: invalidCapabilities.length,
      });
    const row = await prisma.service.update({
      where: { id: serviceId },
      data: {
        requiresDevice: payload.requiresDevice === true,
        rooms: { set: roomIds.map((id) => ({ id })) },
        devices: { set: deviceIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });
    await prisma.auditLog.create({
      data: {
        actor: user.email,
        action: "calendar_service_configured",
        entity: "Service",
        entityId: row.id,
      },
    });
    return NextResponse.json({ id: row.id });
  }

  return bad("unknown_action");
}
