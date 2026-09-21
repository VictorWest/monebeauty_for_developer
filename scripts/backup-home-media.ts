// Preservation snapshot for the home page image refresh.
//
// Captures the current SiteMediaSlot rows (image path, focal point, per-locale
// alt text) for the three slots being changed on the home page, so the
// original photos can be restored later if the client asks.
//
// Refuses to overwrite an existing snapshot (use --force to intentionally
// recapture), same guard as backup-laser-content.ts.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUTPUT = join(process.cwd(), "content/backups/home-media-original.json");
const force = process.argv.includes("--force");
const KEYS = ["home.hero-poster", "home.area.face", "home.area.body"];

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const rows = await prisma.siteMediaSlot.findMany({
    where: { key: { in: KEYS } },
    include: { contents: true },
  });

  const snapshot = {
    capturedAt: new Date().toISOString(),
    slots: rows.map((row) => ({
      key: row.key,
      image: row.image,
      focalX: row.focalX,
      focalY: row.focalY,
      decorative: row.decorative,
      contents: row.contents.map((c) => ({ locale: c.locale, alt: c.alt })),
    })),
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ wrote: OUTPUT, slots: snapshot.slots.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
