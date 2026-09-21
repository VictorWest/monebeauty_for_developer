// Reverts a service's options to the snapshot captured by
// backup-service-options.ts --service=<slug>. Dry-run by default; --apply to write.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const slug = process.argv.find((a) => a.startsWith("--service="))?.split("=")[1];
if (!slug) throw new Error("Usage: restore-service-options.ts --service=<slug> [--apply]");
const INPUT = join(process.cwd(), `content/backups/${slug}-original-page.json`);

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
  console.log(`Restoring ${snapshot.service.slug} from snapshot captured ${snapshot.capturedAt}`);

  const service = await prisma.service.findUnique({ where: { slug: snapshot.service.slug } });
  if (!service) throw new Error(`${snapshot.service.slug} service not found`);

  for (const option of snapshot.service.options) {
    const existingOption = await prisma.serviceOption.findUnique({
      where: { serviceId_key: { serviceId: service.id, key: option.key } },
    });
    if (!existingOption) {
      console.warn(`Skipping option "${option.key}": no longer exists.`);
      continue;
    }
    console.log(apply ? `Restoring ServiceOption[${option.key}]…` : `[dry run] Would restore ServiceOption[${option.key}]`);
    if (apply) {
      for (const content of option.contents) {
        const existingContent = await prisma.serviceOptionContent.findUnique({
          where: { optionId_locale: { optionId: existingOption.id, locale: content.locale } },
        });
        if (!existingContent) continue;
        await prisma.serviceOptionContent.update({
          where: { id: existingContent.id },
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
