// One-off correction: the real Ilona/Irena/Vladislava/Inna practitioner
// records hold zero capabilities, zero qualifications, and zero appointments
// in this environment: the four "Staff Member N" practitioners (now
// relabeled with these same public names, see
// rename-demo-staff-public-names.ts) are the ones actually doing the work.
// Deactivate the empty duplicates so the admin staff list isn't showing each
// name twice. Verified before running: no linked Staff/User login, no
// appointments, no capabilities on any of the four. Safe to re-run
// (idempotent).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NAMES = ["Ilona Bagaturija", "Irena", "Vladislava", "Inna"];

async function main() {
  const target = await prisma.practitioner.findMany({
    where: { name: { in: NAMES } },
    select: {
      id: true,
      name: true,
      active: true,
      _count: { select: { appointments: true, capabilities: true } },
    },
  });
  const unsafe = target.filter(
    (p) => p._count.appointments > 0 || p._count.capabilities > 0,
  );
  if (unsafe.length) {
    console.error(
      JSON.stringify({ refused: "not empty", unsafe }, null, 2),
    );
    process.exitCode = 1;
    return;
  }
  const result = await prisma.practitioner.updateMany({
    where: { id: { in: target.map((p) => p.id) } },
    data: { active: false },
  });
  console.log(JSON.stringify({ deactivated: result.count, target }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
