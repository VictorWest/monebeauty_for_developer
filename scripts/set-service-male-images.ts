// Seeds Service.maleImage with the men's photos we already have (real,
// on-brand) for the new dedicated men's landing page (/palvelut/miehille).
// Services with no entry here fall back to the ImageSlot placeholder on
// that page rather than showing a woman's photo — see Round 5 in the image
// briefs doc for the remaining prompts (body, endospheres, rf, trichology,
// brows) to close that gap.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MALE_IMAGES: Record<string, string> = {
  facial: "/media/home/treatment-areas/men.jpg",
  laser: "/media/clinic/laser/laser-men-back-hair-removal.jpg",
  body: "/media/men/body.jpg",
  endospheres: "/media/men/endospheres.jpg",
  rf: "/media/men/rf.jpg",
  trichology: "/media/men/trichology.jpg",
  brows: "/media/men/brows.jpg",
  packages: "/media/men/packages.jpg",
  injectable: "/media/men/injectable.jpg",
  consultation: "/media/men/consultation.jpg",
};

async function main() {
  const results: Record<string, boolean> = {};
  for (const [slug, image] of Object.entries(MALE_IMAGES)) {
    const before = await prisma.service.findUniqueOrThrow({ where: { slug }, select: { maleImage: true } });
    if (before.maleImage !== image) {
      await prisma.service.update({ where: { slug }, data: { maleImage: image } });
    }
    results[slug] = before.maleImage !== image;
  }
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
