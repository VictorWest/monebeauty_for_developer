// One-off correction: the four demo "Staff Member N" practitioners are the
// only ones holding any PractitionerServiceCapability/qualification rows in
// this environment (see the real Ilona/Irena/Vladislava/Inna records, which
// currently have zero), so they're what the public booking wizard actually
// resolves and displays. Until real capability data is entered for the real
// roster, give these four the real public names instead of the generic
// "Staff" fallback (Practitioner.publicName is customer-facing only:
// internal `name`, login email, and admin/provisioning matching by
// "Staff Member N" are untouched). Safe to re-run (idempotent).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ASSIGNMENTS: Record<string, string> = {
  "Staff Member 1": "Ilona",
  "Staff Member 2": "Irena",
  "Staff Member 3": "Vladislava",
  "Staff Member 4": "Inna",
};

async function main() {
  const before = await prisma.practitioner.findMany({
    where: { name: { in: Object.keys(ASSIGNMENTS) } },
    select: { id: true, name: true, publicName: true },
  });
  for (const practitioner of before) {
    const publicName = ASSIGNMENTS[practitioner.name];
    if (!publicName) continue;
    await prisma.practitioner.update({
      where: { id: practitioner.id },
      data: { publicName },
    });
  }
  const after = await prisma.practitioner.findMany({
    where: { name: { in: Object.keys(ASSIGNMENTS) } },
    select: { id: true, name: true, publicName: true },
  });
  console.log(JSON.stringify({ before, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
