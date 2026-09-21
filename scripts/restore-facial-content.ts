// Reverts the Facial service page image back to the snapshot captured by
// backup-facial-content.ts. Dry-run by default; pass --apply to write it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const INPUT = join(process.cwd(), "content/backups/facial-original-page.json");
const apply = process.argv.includes("--apply");

type Snapshot = {
  capturedAt: string;
  service: {
    slug: string;
    images: string[];
    imageFocalX: number;
    imageFocalY: number;
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
  };
};

async function main() {
  const snapshot = JSON.parse(readFileSync(INPUT, "utf8")) as Snapshot;
  console.log(`Restoring from snapshot captured ${snapshot.capturedAt}`);

  const service = await prisma.service.findUnique({ where: { slug: snapshot.service.slug } });
  if (!service) throw new Error("facial service not found");

  console.log(apply ? "Restoring Service.images/focal point…" : "[dry run] Would restore Service.images/focal point");
  if (apply) {
    await prisma.service.update({
      where: { id: service.id },
      data: { images: snapshot.service.images, imageFocalX: snapshot.service.imageFocalX, imageFocalY: snapshot.service.imageFocalY },
    });
  }

  for (const option of snapshot.service.options) {
    const existingOption = await prisma.serviceOption.findUnique({
      where: { serviceId_key: { serviceId: service.id, key: option.key } },
    });
    if (!existingOption) {
      console.warn(`Skipping option "${option.key}": no longer exists.`);
      continue;
    }
    if (apply) {
      await prisma.serviceOption.update({
        where: { id: existingOption.id },
        data: { displayOrder: option.displayOrder, image: option.image, imageFocalX: option.imageFocalX, imageFocalY: option.imageFocalY },
      });
      for (const content of option.contents) {
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

  console.log(apply ? "Done." : "Dry run complete. Re-run with --apply to write these changes.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
