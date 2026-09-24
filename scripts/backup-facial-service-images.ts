// Snapshots Service(facial).images before swapping in the new hands-only
// skincare hero (client feedback: the old device-on-cheek photo read as an
// RF/microcurrent treatment, not representative of Facial's ~22 options).
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const service = await prisma.service.findUniqueOrThrow({
    where: { slug: "facial" },
    select: { slug: true, images: true, imageFocalX: true, imageFocalY: true },
  });
  const dir = join(process.cwd(), "content/backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = join(dir, `facial-service-images-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(out, JSON.stringify(service, null, 2) + "\n", "utf8");
  console.log(`Backed up to ${out}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
