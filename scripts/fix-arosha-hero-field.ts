// Corrective fix: ContentPage has a dedicated `hero` column, separate from
// the body markdown's embedded images, and AroshaPage prefers it
// (`content.hero || layout.introImages[0]`). update-arosha-images.ts only
// swapped the body's embedded image reference, missing this column entirely
// — so the old photo kept winning regardless of the body-level swap.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NEW_HERO = "/media/arosha/hero.jpg";

async function main() {
  const pages = await prisma.contentPage.findMany({ where: { slug: "arosha" } });
  const results: Record<string, boolean> = {};
  for (const page of pages) {
    const changed = page.hero !== NEW_HERO;
    if (changed) {
      await prisma.contentPage.update({ where: { id: page.id }, data: { hero: NEW_HERO } });
    }
    results[page.locale] = changed;
  }
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
