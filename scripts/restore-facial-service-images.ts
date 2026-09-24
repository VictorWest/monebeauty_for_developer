// Restores Service(facial).images from a backup-facial-service-images.ts
// snapshot. Usage: npx tsx scripts/restore-facial-service-images.ts content/backups/facial-service-images-YYYY-MM-DD.json
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: restore-facial-service-images.ts <backup-file>");
  const data: { slug: string; images: string[]; imageFocalX: number; imageFocalY: number } =
    JSON.parse(readFileSync(file, "utf8"));
  await prisma.service.update({
    where: { slug: data.slug },
    data: { images: data.images, imageFocalX: data.imageFocalX, imageFocalY: data.imageFocalY },
  });
  console.log(`Restored ${data.slug} images from ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
