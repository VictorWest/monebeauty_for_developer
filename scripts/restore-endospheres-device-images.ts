// Restores Service.images for the endospheres stub services from a
// backup-endospheres-device-images.ts snapshot.
// Usage: npx tsx scripts/restore-endospheres-device-images.ts content/backups/endospheres-device-images-YYYY-MM-DD.json
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: restore-endospheres-device-images.ts <backup-file>");
  const rows: Array<{ slug: string; images: string[] }> = JSON.parse(readFileSync(file, "utf8"));
  for (const row of rows) {
    await prisma.service.updateMany({ where: { slug: row.slug }, data: { images: row.images } });
  }
  console.log(`Restored ${rows.length} services from ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
