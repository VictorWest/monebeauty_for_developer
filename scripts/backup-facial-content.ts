// Preservation snapshot for the Facial service page image refresh.
// Facial has no Technology/editorial page, just a Service + its options.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUTPUT = join(process.cwd(), "content/backups/facial-original-page.json");
const force = process.argv.includes("--force");

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const service = await prisma.service.findUnique({
    where: { slug: "facial" },
    include: {
      options: {
        orderBy: { displayOrder: "asc" },
        include: { contents: { orderBy: { locale: "asc" } } },
      },
    },
  });
  if (!service) throw new Error("facial service not found");

  const snapshot = {
    capturedAt: new Date().toISOString(),
    service: {
      slug: service.slug,
      images: service.images,
      imageFocalX: service.imageFocalX,
      imageFocalY: service.imageFocalY,
      options: service.options.map((option) => ({
        key: option.key,
        displayOrder: option.displayOrder,
        image: option.image,
        imageFocalX: option.imageFocalX,
        imageFocalY: option.imageFocalY,
        contents: option.contents.map((content) => ({
          locale: content.locale,
          group: content.group,
          name: content.name,
          summary: content.summary,
          description: content.description,
          imageAlt: content.imageAlt,
          durationLabel: content.durationLabel,
          priceLabel: content.priceLabel,
          status: content.status,
        })),
      })),
    },
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ wrote: OUTPUT, options: snapshot.service.options.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
