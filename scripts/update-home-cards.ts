// Home page image refresh, part 2: the remaining service cards + the
// Hair/Men area teasers. (Hero, Face, and Body area teasers were done in an
// earlier pass.)
//
// Safe to re-run: each write only applies if the current value differs.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SERVICE_IMAGE_UPDATES: Record<string, string> = {
  endospheres: "/media/home/endospheres-card.jpg",
  laser: "/media/home/laser-card.jpg",
  body: "/media/home/body-card.jpg",
  trichology: "/media/home/trichology-card.jpg",
  brows: "/media/home/brows-card.jpg",
  consultation: "/media/home/consultation-card.jpg",
};

const SITE_MEDIA_UPDATES: Record<string, string> = {
  "home.area.hair": "/media/home/treatment-areas/hair.jpg",
  "home.area.men": "/media/home/treatment-areas/men.jpg",
};

async function main() {
  const serviceResults: Record<string, boolean> = {};
  for (const [slug, image] of Object.entries(SERVICE_IMAGE_UPDATES)) {
    const service = await prisma.service.findUnique({ where: { slug } });
    if (!service) throw new Error(`${slug} service not found`);
    const changed = service.images[0] !== image;
    if (changed) {
      await prisma.service.update({
        where: { id: service.id },
        data: { images: [image, ...service.images.slice(1)] },
      });
    }
    serviceResults[slug] = changed;
  }

  const siteMediaResults: Record<string, boolean> = {};
  for (const [key, image] of Object.entries(SITE_MEDIA_UPDATES)) {
    const slot = await prisma.siteMediaSlot.findUnique({ where: { key } });
    if (!slot) throw new Error(`SiteMediaSlot ${key} not found`);
    const changed = slot.image !== image;
    if (changed) {
      await prisma.siteMediaSlot.update({ where: { key }, data: { image } });
    }
    siteMediaResults[key] = changed;
  }

  console.log(JSON.stringify({ serviceResults, siteMediaResults }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
