// Snapshots Service.multiProcedureBooking for every service before Phase 1
// of the booking-wizard UX fix (enabling the laser-style cart flow for
// facial/rf/trichology). Restore with restore-multi-procedure-flags.ts.
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany({
    select: { slug: true, multiProcedureBooking: true },
    orderBy: { slug: "asc" },
  });
  const dir = join(process.cwd(), "content/backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = join(dir, `multi-procedure-flags-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(out, JSON.stringify(services, null, 2) + "\n", "utf8");
  console.log(`Backed up ${services.length} services to ${out}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
