// Home page image refresh, step 1 of the project-wide photo update.
//
// Swaps the three home-page-specific site-media slots (hero banner + the
// Face/Body treatment-area teaser photos) for the clinic-supplied
// replacements. Hair/Men area photos are left untouched: no matching new
// photo exists for them in this pass.
//
// Safe to re-run: no-ops once a slot already carries the new image.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UPDATES: Record<string, string> = {
  "home.hero-poster": "/media/home/hero-poster-practitioner-focus.png",
  "home.area.face": "/media/home/treatment-areas/face.jpg",
  "home.area.body": "/media/home/treatment-areas/body.jpg",
};

async function main() {
  const results: Record<string, { before: string | null; changed: boolean }> = {};

  for (const [key, image] of Object.entries(UPDATES)) {
    const existing = await prisma.siteMediaSlot.findUnique({ where: { key } });
    if (!existing) throw new Error(`SiteMediaSlot ${key} not found`);

    const changed = existing.image !== image;
    if (changed) {
      await prisma.siteMediaSlot.update({ where: { key }, data: { image } });
    }
    results[key] = { before: existing.image, changed };
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
