// Snapshots Service.maleImage across all services before seeding the
// dedicated men's landing page (see set-service-male-images.ts).
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany({
    select: { slug: true, maleImage: true },
    orderBy: { slug: "asc" },
  });
  const dir = join(process.cwd(), "content/backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = join(dir, `service-male-images-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(out, JSON.stringify(services, null, 2) + "\n", "utf8");
  console.log(`Backed up ${services.length} services to ${out}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
