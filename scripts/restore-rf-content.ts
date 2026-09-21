// Reverts the RF (Mikroneulan RF) page back to the pre-refresh content
// captured by backup-rf-content.ts. Dry-run by default; pass --apply to write.
// Same shape as restore-laser-content.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const INPUT = join(process.cwd(), "content/backups/rf-original-page.json");
const apply = process.argv.includes("--apply");

type Snapshot = {
  capturedAt: string;
  technology: {
    slug: string;
    publicPath: string;
    images: string[];
    imageFocalX: number;
    imageFocalY: number;
    contents: Array<{
      locale: Locale;
      name: string;
      specification: string | null;
      summary: string;
      body: string;
      imageAlt: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      seoIndexable: boolean;
      status: "DRAFT" | "PUBLISHED";
    }>;
  };
  relatedService: {
    slug: string;
    options: Array<{
      key: string;
      displayOrder: number;
      image: string | null;
      imageFocalX: number;
      imageFocalY: number;
      contents: Array<{
        locale: Locale;
        group: string | null;
        name: string;
        summary: string;
        description: string;
        imageAlt: string | null;
        durationLabel: string | null;
        priceLabel: string | null;
        status: "DRAFT" | "PUBLISHED";
      }>;
    }>;
  } | null;
};

async function main() {
  const snapshot = JSON.parse(readFileSync(INPUT, "utf8")) as Snapshot;
  console.log(`Restoring from snapshot captured ${snapshot.capturedAt}`);

  const technology = await prisma.technology.findUnique({ where: { slug: snapshot.technology.slug } });
  if (!technology) throw new Error("rf technology not found");

  console.log(apply ? "Restoring Technology.images/focal point…" : "[dry run] Would restore Technology.images/focal point");
  if (apply) {
    await prisma.technology.update({
      where: { id: technology.id },
      data: {
        images: snapshot.technology.images,
        imageFocalX: snapshot.technology.imageFocalX,
        imageFocalY: snapshot.technology.imageFocalY,
      },
    });
  }

  for (const content of snapshot.technology.contents) {
    console.log(apply ? `Restoring TechnologyContent[${content.locale}]…` : `[dry run] Would restore TechnologyContent[${content.locale}]`);
    if (apply) {
      await prisma.technologyContent.update({
        where: { technologyId_locale: { technologyId: technology.id, locale: content.locale } },
        data: {
          name: content.name,
          specification: content.specification,
          summary: content.summary,
          body: content.body,
          imageAlt: content.imageAlt,
          seoTitle: content.seoTitle,
          seoDescription: content.seoDescription,
          seoIndexable: content.seoIndexable,
          status: content.status,
        },
      });
    }
  }

  if (snapshot.relatedService) {
    const service = await prisma.service.findUnique({ where: { slug: snapshot.relatedService.slug } });
    if (!service) throw new Error(`service ${snapshot.relatedService.slug} not found`);

    for (const option of snapshot.relatedService.options) {
      const existingOption = await prisma.serviceOption.findUnique({
        where: { serviceId_key: { serviceId: service.id, key: option.key } },
      });
      if (!existingOption) {
        console.warn(`Skipping option "${option.key}": no longer exists.`);
        continue;
      }

      console.log(apply ? `Restoring ServiceOption[${option.key}]…` : `[dry run] Would restore ServiceOption[${option.key}]`);
      if (apply) {
        await prisma.serviceOption.update({
          where: { id: existingOption.id },
          data: { displayOrder: option.displayOrder, image: option.image, imageFocalX: option.imageFocalX, imageFocalY: option.imageFocalY },
        });
      }

      for (const content of option.contents) {
        console.log(
          apply
            ? `Restoring ServiceOptionContent[${option.key}/${content.locale}]…`
            : `[dry run] Would restore ServiceOptionContent[${option.key}/${content.locale}]`,
        );
        if (apply) {
          await prisma.serviceOptionContent.update({
            where: { optionId_locale: { optionId: existingOption.id, locale: content.locale } },
            data: {
              group: content.group,
              name: content.name,
              summary: content.summary,
              description: content.description,
              imageAlt: content.imageAlt,
              durationLabel: content.durationLabel,
              priceLabel: content.priceLabel,
              status: content.status,
            },
          });
        }
      }
    }
  }

  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply to write these changes.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
