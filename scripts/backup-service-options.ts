// Preservation snapshot for a service's options, keyed by --service=<slug>.
// Used for the card-summary consistency fixes (trichology, brows, packages):
// same shape as backup-facial-content.ts/backup-body-content.ts, generalized
// so each target service doesn't need its own near-identical script.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const force = process.argv.includes("--force");
const slug = process.argv.find((a) => a.startsWith("--service="))?.split("=")[1];
if (!slug) throw new Error("Usage: backup-service-options.ts --service=<slug> [--out=filename-stem]");
const outStem = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? `${slug}-original-page`;
const OUTPUT = join(process.cwd(), `content/backups/${outStem}.json`);

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const service = await prisma.service.findUnique({
    where: { slug },
    include: {
      options: {
        orderBy: { displayOrder: "asc" },
        include: { contents: { orderBy: { locale: "asc" } } },
      },
    },
  });
  if (!service) throw new Error(`${slug} service not found`);

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
