import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

const STAFF = [
  {
    name: "Staff Member 1",
    aliases: ["Staff Member 1", "Staff1"],
    email: "staff1@example.com",
    color: "#D5897E",
  },
  {
    name: "Staff Member 2",
    aliases: ["Staff Member 2"],
    email: "staff2@example.com",
    color: "#9B9BEF",
  },
  {
    name: "Staff Member 3",
    aliases: ["Staff Member 3"],
    email: "staff3@example.com",
    color: "#7F83D8",
  },
  {
    name: "Staff Member 4",
    aliases: ["Staff Member 4"],
    email: "staff4@example.com",
    color: "#A9B88E",
  },
] as const;

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function main() {
  const temporaryPassword = process.env.STAFF_TEMP_PASSWORD;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!temporaryPassword || temporaryPassword.length < 16)
    throw new Error("STAFF_TEMP_PASSWORD must be at least 16 characters.");

  const passwordHash = await hashPassword(temporaryPassword);
  const result = await prisma.$transaction(
    async (tx) => {
      const practitionerIds: string[] = [];
      const createdEmails: string[] = [];

      for (const [displayOrder, spec] of STAFF.entries()) {
        let user =
          spec.name === "Staff Member 1"
            ? await tx.user.findFirst({
                where: {
                  role: "STAFF",
                  OR: [
                    { name: { in: [...spec.aliases], mode: "insensitive" } },
                    {
                      staff: {
                        practitioner: {
                          name: { in: [...spec.aliases], mode: "insensitive" },
                        },
                      },
                    },
                  ],
                },
                include: { staff: true },
              })
            : await tx.user.findUnique({
                where: { email: spec.email },
                include: { staff: true },
              });
        if (user && user.role !== "STAFF")
          throw new Error(
            `Refusing to convert ${spec.email} from ${user.role} to STAFF.`,
          );

        let practitionerId = user?.staff?.practitionerId ?? null;
        if (!practitionerId) {
          const matching = await tx.practitioner.findFirst({
            where: {
              name: { in: [...spec.aliases], mode: "insensitive" },
              staff: null,
            },
            orderBy: { id: "asc" },
            select: { id: true },
          });
          practitionerId =
            matching?.id ??
            (
              await tx.practitioner.create({
                data: { name: spec.name, role: "Specialist" },
                select: { id: true },
              })
            ).id;
        }

        await tx.practitioner.update({
          where: { id: practitionerId },
          data: {
            name: spec.name,
            role: "Specialist",
            active: true,
            displayOrder,
            calendarColor: spec.color,
          },
        });

        if (user) {
          await tx.user.update({
            where: { id: user.id },
            data: { name: spec.name, status: "ACTIVE" },
          });
          if (user.staff) {
            await tx.staffUser.update({
              where: { userId: user.id },
              data: { practitionerId },
            });
          } else {
            await tx.staffUser.create({
              data: { userId: user.id, practitionerId, daysOff: [] },
            });
          }
        } else {
          user = await tx.user.create({
            data: {
              email: spec.email,
              name: spec.name,
              role: "STAFF",
              status: "ACTIVE",
              locale: "fi",
              emailVerifiedAt: new Date(),
              mustChangePassword: true,
              passwordHash,
              staff: { create: { practitionerId, daysOff: [] } },
            },
            include: { staff: true },
          });
          createdEmails.push(spec.email);
          await tx.auditLog.create({
            data: {
              actor: "system",
              actorUserId: user.id,
              actorRole: "STAFF",
              action: "staff_account_provisioned",
              entity: "User",
              entityId: user.id,
              metadata: { practitionerId },
            },
          });
        }
        practitionerIds.push(practitionerId);
      }

      if (process.env.ASSIGN_ALL_STAFF_TO_SERVICES === "true") {
        const services = await tx.service.findMany({
          where: { bookable: true, archivedAt: null },
          select: {
            id: true,
            rooms: { where: { active: true }, select: { id: true } },
            devices: { where: { active: true }, select: { id: true } },
          },
        });
        for (const service of services) {
          await tx.service.update({
            where: { id: service.id },
            data: { primaryPractitionerId: null },
          });
          for (const practitionerId of practitionerIds) {
            for (const room of service.rooms) {
              await tx.practitionerServiceCapability.upsert({
                where: {
                  practitionerId_serviceId_roomId: {
                    practitionerId,
                    serviceId: service.id,
                    roomId: room.id,
                  },
                },
                update: {},
                create: {
                  practitionerId,
                  serviceId: service.id,
                  roomId: room.id,
                  devices: {
                    create: service.devices.map((device) => ({
                      deviceId: device.id,
                    })),
                  },
                },
              });
            }
          }
        }
      }

      const synthetic = await tx.practitioner.findFirst({
        where: { name: "Mone Beauty Clinic", id: { notIn: practitionerIds } },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      let migratedAppointments = 0;
      if (synthetic) {
        const future = await tx.appointment.findMany({
          where: {
            practitionerId: synthetic.id,
            start: { gte: new Date() },
            status: { not: "CANCELLED" },
          },
          orderBy: { start: "asc" },
          select: { id: true, start: true, end: true },
        });
        for (const appointment of future) {
          let target: string | null = null;
          for (const practitionerId of practitionerIds) {
            const [appointmentConflict, blockConflict] = await Promise.all([
              tx.appointment.findFirst({
                where: {
                  id: { not: appointment.id },
                  practitionerId,
                  status: { not: "CANCELLED" },
                  start: { lt: appointment.end },
                  end: { gt: appointment.start },
                },
                select: { id: true },
              }),
              tx.calendarBlock.findFirst({
                where: {
                  status: "ACTIVE",
                  participants: { some: { practitionerId } },
                  start: { lt: appointment.end },
                  end: { gt: appointment.start },
                },
                select: { id: true },
              }),
            ]);
            if (!appointmentConflict && !blockConflict) {
              target = practitionerId;
              break;
            }
          }
          if (!target)
            throw new Error(
              `No real employee can receive future appointment ${appointment.id}.`,
            );
          await tx.appointment.update({
            where: { id: appointment.id },
            data: { practitionerId: target, version: { increment: 1 } },
          });
          migratedAppointments += 1;
        }
        await tx.practitioner.update({
          where: { id: synthetic.id },
          data: { active: false },
        });
        await tx.practitionerServiceCapability.deleteMany({
          where: { practitionerId: synthetic.id },
        });
      }

      const labels = [
        ["lunch", "Ruokatauko"],
        ["personal", "Henkilökohtainen meno"],
        ["errand", "Työmeno"],
        ["sick", "Sairasloma"],
        ["vacation", "Loma"],
      ] as const;
      for (const [key, labelFi] of labels) {
        await tx.calendarBlockTemplate.updateMany({
          where: { key },
          data: { labelFi },
        });
      }
      await tx.auditLog.create({
        data: {
          actor: "system",
          action: "calendar_staff_roster_provisioned",
          entity: "Practitioner",
          entityId: practitionerIds[0],
          metadata: {
            practitionerIds,
            migratedAppointments,
            syntheticRetired: Boolean(synthetic),
          },
        },
      });
      return {
        createdEmails,
        practitionerCount: practitionerIds.length,
        migratedAppointments,
        syntheticRetired: Boolean(synthetic),
      };
    },
    { timeout: 120_000 },
  );

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
