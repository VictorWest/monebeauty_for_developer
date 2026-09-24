// Restores Service.multiProcedureBooking from a backup-multi-procedure-flags.ts
// snapshot. Usage: npx tsx scripts/restore-multi-procedure-flags.ts content/backups/multi-procedure-flags-YYYY-MM-DD.json
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: restore-multi-procedure-flags.ts <backup-file>");
  const rows: Array<{ slug: string; multiProcedureBooking: boolean }> = JSON.parse(
    readFileSync(file, "utf8"),
  );
  for (const row of rows) {
    await prisma.service.update({
      where: { slug: row.slug },
      data: { multiProcedureBooking: row.multiProcedureBooking },
    });
  }
  console.log(`Restored ${rows.length} services from ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
