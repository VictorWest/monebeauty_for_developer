// Preservation snapshot for the Endospheres technology page + editorial
// site-media slots, before the new photography goes in. Same shape as
// backup-laser-content.ts/backup-rf-content.ts, plus the two editorial slots
// that only the Endospheres flagship page uses.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUTPUT = join(process.cwd(), "content/backups/endospheres-original-page.json");
const force = process.argv.includes("--force");
const EDITORIAL_KEYS = ["endospheres.editorial.1", "endospheres.editorial.2"];

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const technology = await prisma.technology.findUnique({
    where: { slug: "endospheres" },
    include: { contents: { orderBy: { locale: "asc" } } },
  });
  if (!technology) throw new Error("endospheres technology not found");

  const editorialSlots = await prisma.siteMediaSlot.findMany({
    where: { key: { in: EDITORIAL_KEYS } },
  });

  const snapshot = {
    capturedAt: new Date().toISOString(),
    technology: {
      slug: technology.slug,
      images: technology.images,
      imageFocalX: technology.imageFocalX,
      imageFocalY: technology.imageFocalY,
      contents: technology.contents.map((content) => ({
        locale: content.locale,
        body: content.body,
      })),
    },
    editorialSlots: editorialSlots.map((slot) => ({ key: slot.key, image: slot.image })),
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ wrote: OUTPUT, editorialSlots: snapshot.editorialSlots.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
