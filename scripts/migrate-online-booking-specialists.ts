import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const BUFFER_MS = 15 * 60_000;
const roster = [
  {
    internalName: "Ilona Bagaturija",
    publicName: "Ilona",
    aliases: ["Ilona Bagaturija", "Ilona"],
  },
  { internalName: "Irena", publicName: "Irena", aliases: ["Irena", "Irene"] },
  { internalName: "Inna", publicName: "Inna", aliases: ["Inna"] },
  {
    internalName: "Vladislava",
    publicName: "Vladislava",
    aliases: ["Vladislava"],
  },
] as const;

async function futureBufferConflicts() {
  const appointments = await prisma.appointment.findMany({
    where: { status: { not: "CANCELLED" }, end: { gt: new Date() } },
    orderBy: { start: "asc" },
    select: {
      id: true,
      practitionerId: true,
      roomId: true,
      deviceId: true,
      start: true,
      end: true,
    },
  });
  const conflicts: Array<{
    resource: string;
    first: string;
    second: string;
    gapMinutes: number;
  }> = [];
  const resources = (appointment: (typeof appointments)[number]) => [
    `practitioner:${appointment.practitionerId}`,
    ...(appointment.roomId ? [`room:${appointment.roomId}`] : []),
    ...(appointment.deviceId ? [`device:${appointment.deviceId}`] : []),
  ];
  for (let leftIndex = 0; leftIndex < appointments.length; leftIndex += 1) {
    const left = appointments[leftIndex];
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < appointments.length;
      rightIndex += 1
    ) {
      const right = appointments[rightIndex];
      if (right.start.getTime() >= left.end.getTime() + BUFFER_MS) break;
      const shared = resources(left).find((resource) =>
        resources(right).includes(resource),
      );
      if (!shared) continue;
      conflicts.push({
        resource: shared,
        first: left.id,
        second: right.id,
        gapMinutes: Math.floor(
          (right.start.getTime() - left.end.getTime()) / 60_000,
        ),
      });
    }
  }
  return conflicts;
}

async function main() {
  const conflicts = await futureBufferConflicts();
  if (conflicts.length) {
    console.error(JSON.stringify({ ok: false, conflicts }, null, 2));
    process.exitCode = 1;
    return;
  }

  const practitioners = await prisma.practitioner.findMany({
    select: { id: true, name: true, publicName: true },
  });
  const normalized = (value: string) => value.trim().toLocaleLowerCase("en");
  const irene = practitioners.filter(
    (item) => normalized(item.name) === "irene",
  );
  const irena = practitioners.filter(
    (item) => normalized(item.name) === "irena",
  );
  const plan = roster.map((spec) => ({
    ...spec,
    existing: practitioners.find((item) =>
      spec.aliases.some((alias) => normalized(alias) === normalized(item.name)),
    ),
  }));
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: apply ? "apply" : "dry-run",
        renameIrene:
          irene.length === 1 && irena.length === 0 ? irene[0].id : null,
        create: plan
          .filter((item) => !item.existing)
          .map((item) => item.internalName),
      },
      null,
      2,
    ),
  );
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    if (irene.length === 1 && irena.length === 0) {
      await tx.practitioner.update({
        where: { id: irene[0].id },
        data: { name: "Irena", publicName: "Irena" },
      });
    }
    for (const item of plan) {
      const id =
        item.existing?.id ??
        (
          await tx.practitioner.create({
            data: {
              name: item.internalName,
              publicName: item.publicName,
              role: "Specialist",
              active: true,
            },
            select: { id: true },
          })
        ).id;
      await tx.practitioner.updateMany({
        where: { id, OR: [{ publicName: null }, { publicName: "" }] },
        data: { publicName: item.publicName },
      });
    }

    const capabilities = await tx.practitionerServiceCapability.findMany({
      select: { practitionerId: true, serviceId: true },
    });
    const options = await tx.serviceOption.findMany({
      where: { bookable: true, published: true, archivedAt: null },
      select: { id: true, serviceId: true, bookingServiceId: true },
    });
    const qualifications = capabilities.flatMap((capability) =>
      options
        .filter(
          (option) =>
            (option.bookingServiceId ?? option.serviceId) ===
            capability.serviceId,
        )
        .map((option) => ({
          practitionerId: capability.practitionerId,
          serviceOptionId: option.id,
        })),
    );
    if (qualifications.length)
      await tx.practitionerServiceOptionQualification.createMany({
        data: qualifications,
        skipDuplicates: true,
      });
    const future = await tx.appointment.findMany({
      where: { status: { not: "CANCELLED" }, end: { gt: new Date() } },
      select: { id: true, end: true },
    });
    for (const appointment of future) {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          bufferMinutes: 15,
          reservedUntil: new Date(appointment.end.getTime() + BUFFER_MS),
          bufferEnforced: true,
        },
      });
    }
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
