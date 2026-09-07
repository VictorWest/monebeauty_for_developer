import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/routing";

type SchedulingClient = Prisma.TransactionClient | typeof prisma;

export type PublicSpecialist = { id: string; name: string };

export async function qualifiedSpecialists(
  input: { serviceKey: string; optionKey: string; locale?: Locale },
  client: SchedulingClient = prisma,
): Promise<PublicSpecialist[]> {
  const db = client as typeof prisma;
  const option = await db.serviceOption.findFirst({
    where: {
      key: input.optionKey,
      bookable: true,
      published: true,
      archivedAt: null,
      service: {
        slug: input.serviceKey,
        bookable: true,
        archivedAt: null,
        ...(input.locale
          ? {
              contents: { some: { locale: input.locale, status: "PUBLISHED" } },
            }
          : {}),
      },
      ...(input.locale
        ? { contents: { some: { locale: input.locale, status: "PUBLISHED" } } }
        : {}),
    },
    select: {
      id: true,
      serviceId: true,
      bookingServiceId: true,
      bookingService: { select: { requiresDevice: true } },
      service: { select: { requiresDevice: true } },
      qualifications: {
        where: { practitioner: { active: true } },
        select: {
          practitioner: {
            select: {
              id: true,
              name: true,
              publicName: true,
              displayOrder: true,
            },
          },
        },
      },
    },
  });
  if (!option?.qualifications.length) return [];
  const schedulingServiceId = option.bookingServiceId ?? option.serviceId;
  const requiresDevice =
    option.bookingService?.requiresDevice ?? option.service.requiresDevice;
  const practitionerIds = option.qualifications.map(
    ({ practitioner }) => practitioner.id,
  );
  const capabilities = await db.practitionerServiceCapability.findMany({
    where: {
      serviceId: schedulingServiceId,
      practitionerId: { in: practitionerIds },
      practitioner: { active: true },
      room: { active: true },
      ...(requiresDevice
        ? { devices: { some: { device: { active: true } } } }
        : {}),
    },
    select: { practitionerId: true },
  });
  const capable = new Set(capabilities.map((item) => item.practitionerId));
  return option.qualifications
    .map(({ practitioner }) => practitioner)
    .filter((practitioner) => capable.has(practitioner.id))
    .sort(
      (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    )
    .map((practitioner) => ({
      id: practitioner.id,
      name:
        practitioner.publicName?.trim() || practitioner.name.split(/\s+/)[0],
    }));
}
