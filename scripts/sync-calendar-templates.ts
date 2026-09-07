import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { INTERNAL_CALENDAR_SERVICES } from "../lib/internal-calendar-services";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const rows = INTERNAL_CALENDAR_SERVICES.map(
    (service) =>
      Prisma.sql`(
      ${randomUUID()}, ${service.key}, ${service.labelFi}, ${service.labelEn},
      ${service.labelRu}, ${service.defaultDurationMin}, ${service.color}, TRUE,
      ${service.displayOrder}, ${now}, ${now}
    )`,
  );

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "CalendarBlockTemplate" (
      "id", "key", "labelFi", "labelEn", "labelRu", "defaultDurationMin",
      "color", "active", "displayOrder", "createdAt", "updatedAt"
    )
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("key") DO UPDATE SET
      "labelFi" = EXCLUDED."labelFi",
      "labelEn" = EXCLUDED."labelEn",
      "labelRu" = EXCLUDED."labelRu",
      "defaultDurationMin" = EXCLUDED."defaultDurationMin",
      "color" = EXCLUDED."color",
      "active" = TRUE,
      "displayOrder" = EXCLUDED."displayOrder",
      "updatedAt" = EXCLUDED."updatedAt"
  `);

  const active = await prisma.calendarBlockTemplate.count({
    where: {
      active: true,
      key: { in: INTERNAL_CALENDAR_SERVICES.map((service) => service.key) },
    },
  });
  if (active !== INTERNAL_CALENDAR_SERVICES.length) {
    throw new Error(
      `Expected ${INTERNAL_CALENDAR_SERVICES.length} active templates, received ${active}.`,
    );
  }
  console.log(JSON.stringify({ activeTemplates: active }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
