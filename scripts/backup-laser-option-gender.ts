// Snapshots ServiceOption.targetGender for laser before backfilling the
// per-zone Women/Men/Both split (see set-laser-option-gender.ts).
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const options = await prisma.serviceOption.findMany({
    where: { service: { slug: "laser" } },
    select: { key: true, targetGender: true },
    orderBy: { key: "asc" },
  });
  const dir = join(process.cwd(), "content/backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = join(dir, `laser-option-gender-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(out, JSON.stringify(options, null, 2) + "\n", "utf8");
  console.log(`Backed up ${options.length} options to ${out}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
