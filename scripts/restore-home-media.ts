// Reverts the home page's site-media slots to the snapshot captured by
// backup-home-media.ts, in case the client asks to roll back the image
// refresh. Dry-run by default; pass --apply to write it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const INPUT = join(process.cwd(), "content/backups/home-media-original.json");
const apply = process.argv.includes("--apply");

type Snapshot = {
  capturedAt: string;
  slots: Array<{
    key: string;
    image: string | null;
    focalX: number;
    focalY: number;
    decorative: boolean;
    contents: Array<{ locale: Locale; alt: string }>;
  }>;
};

async function main() {
  const snapshot = JSON.parse(readFileSync(INPUT, "utf8")) as Snapshot;
  console.log(`Restoring from snapshot captured ${snapshot.capturedAt}`);

  for (const slot of snapshot.slots) {
    console.log(
      apply ? `Restoring SiteMediaSlot[${slot.key}]…` : `[dry run] Would restore SiteMediaSlot[${slot.key}] -> ${slot.image}`,
    );
    if (apply) {
      await prisma.siteMediaSlot.update({
        where: { key: slot.key },
        data: { image: slot.image, focalX: slot.focalX, focalY: slot.focalY, decorative: slot.decorative },
      });
      for (const content of slot.contents) {
        await prisma.siteMediaSlotContent.update({
          where: { slotKey_locale: { slotKey: slot.key, locale: content.locale } },
          data: { alt: content.alt },
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
