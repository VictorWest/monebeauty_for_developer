// Snapshots Service.images for the endospheres stub services before
// swapping the old (wrong device) stock photo for the client's real one.
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const SLUGS = [
  "endospheres",
  "endospheres-30",
  "endospheres-45",
  "endospheres-60",
  "endospheres-75",
  "endospheres-intro-75",
];

async function main() {
  const services = await prisma.service.findMany({
    where: { slug: { in: SLUGS } },
    select: { slug: true, images: true },
    orderBy: { slug: "asc" },
  });
  const dir = join(process.cwd(), "content/backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = join(dir, `endospheres-device-images-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(out, JSON.stringify(services, null, 2) + "\n", "utf8");
  console.log(`Backed up ${services.length} services to ${out}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
