// Preservation snapshot for the laserkarvanpoisto redesign.
//
// Captures the laser Technology row, its TechnologyContent (all locales),
// and its related Service's ServiceOptions + ServiceOptionContent (all
// locales) exactly as they stand in the database right now, into a single
// committed JSON file. That file is the restore point: if the client ever
// asks to revert the redesigned page, `restore-laser-content.ts` replays it
// back into the database.
//
// Refuses to overwrite an existing snapshot (use --force to intentionally
// recapture) so a second run after edits have already started can't silently
// destroy the one copy of the pre-redesign content.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUTPUT = join(process.cwd(), "content/backups/laser-original-page.json");
const force = process.argv.includes("--force");

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(
      `${OUTPUT} already exists. Re-run with --force only if you are certain ` +
        "the current database still holds the pre-redesign content — otherwise " +
        "this would overwrite the one copy of the original with already-edited data.",
    );
  }

  const technology = await prisma.technology.findUnique({
    where: { slug: "laser" },
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
  if (!technology) throw new Error("laser technology not found");

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
      {
        wrote: OUTPUT,
        technologyContents: snapshot.technology.contents.length,
        serviceOptions: snapshot.relatedService?.options.length ?? 0,
      },
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
