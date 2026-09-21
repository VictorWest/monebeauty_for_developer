// Preservation snapshot for arbitrary SiteMediaSlot keys, e.g.:
//   tsx backup-site-media.ts --keys=home.area.hair,home.area.men --out=home-media-hair-men
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const force = process.argv.includes("--force");
const keysArg = process.argv.find((a) => a.startsWith("--keys="))?.split("=")[1];
const outArg = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1];
if (!keysArg || !outArg) {
  throw new Error("Usage: backup-site-media.ts --keys=key1,key2 --out=filename-stem");
}
const keys = keysArg.split(",");
const OUTPUT = join(process.cwd(), `content/backups/${outArg}-original.json`);

async function main() {
  if (existsSync(OUTPUT) && !force) {
    throw new Error(`${OUTPUT} already exists. Re-run with --force to intentionally recapture.`);
  }

  const slots = await prisma.siteMediaSlot.findMany({ where: { key: { in: keys } } });

  const snapshot = {
    capturedAt: new Date().toISOString(),
    slots: slots.map((slot) => ({
      key: slot.key,
      image: slot.image,
      focalX: slot.focalX,
      focalY: slot.focalY,
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
