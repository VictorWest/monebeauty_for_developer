// Preservation snapshot for the RF (Mikroneulan RF) page photo/text refresh.
// Same shape as backup-laser-content.ts: captures the rf Technology row, its
// TechnologyContent (all locales), and its related Service's ServiceOptions
// + ServiceOptionContent, so the original can be restored if the client asks.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUTPUT = join(process.cwd(), "content/backups/rf-original-page.json");
const force = process.argv.includes("--force");

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const technology = await prisma.technology.findUnique({
    where: { slug: "rf" },
    include: {
      contents: { orderBy: { locale: "asc" } },
      relatedService: {
        include: {
          options: {
            orderBy: { displayOrder: "asc" },
            include: { contents: { orderBy: { locale: "asc" } } },
          },
        },
      },
    },
  });
  if (!technology) throw new Error("rf technology not found");

  const snapshot = {
    capturedAt: new Date().toISOString(),
    technology: {
      slug: technology.slug,
      publicPath: technology.publicPath,
      images: technology.images,
      imageFocalX: technology.imageFocalX,
      imageFocalY: technology.imageFocalY,
      contents: technology.contents.map((content) => ({
        locale: content.locale,
        name: content.name,
        specification: content.specification,
        summary: content.summary,
        body: content.body,
        imageAlt: content.imageAlt,
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
        seoIndexable: content.seoIndexable,
        status: content.status,
      })),
    },
    relatedService: technology.relatedService
      ? {
          slug: technology.relatedService.slug,
          options: technology.relatedService.options.map((option) => ({
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
        }
      : null,
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(
    JSON.stringify(
      { wrote: OUTPUT, technologyContents: snapshot.technology.contents.length, serviceOptions: snapshot.relatedService?.options.length ?? 0 },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
