// Snapshots Service(laser).maleImage before setting it for the first time
// (see set-laser-male-image.ts).
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const service = await prisma.service.findUniqueOrThrow({
    where: { slug: "laser" },
    select: { slug: true, maleImage: true },
  });
  const dir = join(process.cwd(), "content/backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = join(dir, `laser-male-image-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(out, JSON.stringify(service, null, 2) + "\n", "utf8");
  console.log(`Backed up to ${out}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
