import type { Prisma } from "@prisma/client";

export type ResourceKind = "room" | "device";

export const RESOURCE_POOLS = [
  {
    kind: "room" as const,
    key: "treatment-room",
    label: "Treatment room",
  },
  {
    kind: "device" as const,
    key: "endospheres",
    label: "Endospheres",
  },
  { kind: "device" as const, key: "laser", label: "Laser" },
  { kind: "device" as const, key: "rf", label: "MicroRF" },
] as const;

export function resourcePool(kind: ResourceKind, key: string) {
  return RESOURCE_POOLS.find((pool) => pool.kind === kind && pool.key === key);
}

export async function setResourcePoolCount(
  tx: Prisma.TransactionClient,
  kind: ResourceKind,
  poolKey: string,
  count: number,
) {
  const pool = resourcePool(kind, poolKey);
  if (!pool || !Number.isInteger(count) || count < 0 || count > 50) {
    throw new Error("invalid_resource_count");
  }

  if (kind === "room") {
    const source = await tx.room.findFirst({
      where: { poolKey, unitNumber: 1 },
      include: {
        services: { select: { id: true } },
        capabilities: {
          select: {
            practitionerId: true,
            serviceId: true,
            devices: { select: { deviceId: true } },
          },
        },
      },
    });
    if (!source) throw new Error("resource_pool_missing");
    const existing = await tx.room.findMany({
      where: { poolKey },
      orderBy: { unitNumber: "asc" },
      select: { id: true, unitNumber: true },
    });
    const existingNumbers = new Set(existing.map((unit) => unit.unitNumber));
    for (let unitNumber = 1; unitNumber <= count; unitNumber += 1) {
      if (existingNumbers.has(unitNumber)) continue;
      const room = await tx.room.create({
        data: {
          name: `${pool.label} ${unitNumber}`,
          poolKey,
          unitNumber,
          displayOrder: unitNumber,
          active: true,
          services: {
            connect: source.services.map((service) => ({ id: service.id })),
          },
        },
      });
      for (const capability of source.capabilities) {
        await tx.practitionerServiceCapability.upsert({
          where: {
            practitionerId_serviceId_roomId: {
              practitionerId: capability.practitionerId,
              serviceId: capability.serviceId,
              roomId: room.id,
            },
          },
          update: {},
          create: {
            practitionerId: capability.practitionerId,
            serviceId: capability.serviceId,
            roomId: room.id,
            devices: {
              create: capability.devices.map((device) => ({
                deviceId: device.deviceId,
              })),
            },
          },
        });
      }
    }
    const units = await tx.room.findMany({
      where: { poolKey },
      orderBy: { unitNumber: "asc" },
      select: { id: true, unitNumber: true, active: true },
    });
    const deactivatedIds = units
      .filter((unit) => (unit.unitNumber ?? 0) > count && unit.active)
      .map((unit) => unit.id);
    await Promise.all(
      units.map((unit) =>
        tx.room.update({
          where: { id: unit.id },
          data: { active: (unit.unitNumber ?? 0) <= count },
        }),
      ),
    );
    return affectedAppointments(tx, kind, deactivatedIds);
  }

  const source = await tx.device.findFirst({
    where: { poolKey, unitNumber: 1 },
    include: {
      services: { select: { id: true } },
      capabilityLinks: { select: { capabilityId: true } },
    },
  });
  if (!source) throw new Error("resource_pool_missing");
  const existing = await tx.device.findMany({
    where: { poolKey },
    orderBy: { unitNumber: "asc" },
    select: { id: true, unitNumber: true },
  });
  const existingNumbers = new Set(existing.map((unit) => unit.unitNumber));
  for (let unitNumber = 1; unitNumber <= count; unitNumber += 1) {
    if (existingNumbers.has(unitNumber)) continue;
    const device = await tx.device.create({
      data: {
        name: `${pool.label} ${unitNumber}`,
        poolKey,
        unitNumber,
        displayOrder: unitNumber,
        active: true,
        services: {
          connect: source.services.map((service) => ({ id: service.id })),
        },
        capabilityLinks: {
          create: source.capabilityLinks.map((link) => ({
            capabilityId: link.capabilityId,
          })),
        },
      },
    });
    void device;
  }
  const units = await tx.device.findMany({
    where: { poolKey },
    orderBy: { unitNumber: "asc" },
    select: { id: true, unitNumber: true, active: true },
  });
  const deactivatedIds = units
    .filter((unit) => (unit.unitNumber ?? 0) > count && unit.active)
    .map((unit) => unit.id);
  await Promise.all(
    units.map((unit) =>
      tx.device.update({
        where: { id: unit.id },
        data: { active: (unit.unitNumber ?? 0) <= count },
      }),
    ),
  );
  return affectedAppointments(tx, kind, deactivatedIds);
}

async function affectedAppointments(
  tx: Prisma.TransactionClient,
  kind: ResourceKind,
  resourceIds: string[],
) {
  if (!resourceIds.length) return [];
  const activeStatuses = ["BOOKED", "CONFIRMED", "RESCHEDULED"] as const;
  const appointments = await tx.appointment.findMany({
    where: {
      start: { gte: new Date() },
      status: { in: [...activeStatuses] },
      ...(kind === "room"
        ? { roomId: { in: resourceIds } }
        : { deviceId: { in: resourceIds } }),
    },
    orderBy: { start: "asc" },
    select: { id: true },
  });
  return appointments.map((appointment) => appointment.id);
}
