// Restores ServiceOption.targetGender for laser from a
// backup-laser-option-gender.ts snapshot.
// Usage: npx tsx scripts/restore-laser-option-gender.ts content/backups/laser-option-gender-YYYY-MM-DD.json
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: restore-laser-option-gender.ts <backup-file>");
  const rows: Array<{ key: string; targetGender: "WOMEN" | "MEN" | "BOTH" }> = JSON.parse(
    readFileSync(file, "utf8"),
  );
  for (const row of rows) {
    await prisma.serviceOption.updateMany({
      where: { key: row.key, service: { slug: "laser" } },
      data: { targetGender: row.targetGender },
    });
  }
  console.log(`Restored ${rows.length} laser options from ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
