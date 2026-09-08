// One-off correction: the clinic owns exactly 1 physical unit each of Endospheres,
// Laser, and Microneedle RF equipment, but seed/provisioning data modeled 4 units
// each (one per treatment room). That let the booking engine offer up to 4
// simultaneous appointments on equipment the clinic can only run once at a time.
// This deactivates every unit beyond the first per pool, leaving exactly 1 active
// unit per machine. Safe to re-run (idempotent).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.device.updateMany({
    where: {
      poolKey: { in: ["endospheres", "laser", "rf"] },
      unitNumber: { gt: 1 },
    },
    data: { active: false },
  });
  const remaining = await prisma.device.findMany({
    where: { active: true },
    select: { name: true, poolKey: true, unitNumber: true },
  });
  console.log(
    JSON.stringify({ deactivated: result.count, activeDevices: remaining }, null, 2),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
