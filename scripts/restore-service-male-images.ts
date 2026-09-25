// Restores Service.maleImage from a backup-service-male-images.ts snapshot.
// Usage: npx tsx scripts/restore-service-male-images.ts content/backups/service-male-images-YYYY-MM-DD.json
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: restore-service-male-images.ts <backup-file>");
  const rows: Array<{ slug: string; maleImage: string | null }> = JSON.parse(readFileSync(file, "utf8"));
  for (const row of rows) {
    await prisma.service.update({ where: { slug: row.slug }, data: { maleImage: row.maleImage } });
  }
  console.log(`Restored ${rows.length} services from ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
