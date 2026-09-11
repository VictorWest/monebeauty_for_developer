// One-off: turns on the multi-procedure cart (see prisma/schema.prisma's
// Service.multiProcedureBooking) for the Laser hair removal service — the
// client's own example (arms + legs + neck in one visit) and, so far, the
// only service enabled for it. Also reflected in prisma/seed.ts so a fresh
// environment doesn't need this script re-run. Safe to re-run (idempotent).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.service.findUnique({
    where: { slug: "laser" },
    select: { slug: true, multiProcedureBooking: true },
  });
  const result = await prisma.service.updateMany({
    where: { slug: "laser" },
    data: { multiProcedureBooking: true },
  });
  const after = await prisma.service.findUnique({
    where: { slug: "laser" },
    select: { slug: true, multiProcedureBooking: true },
  });
  console.log(JSON.stringify({ before, updated: result.count, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
