// One-off: swaps the laser page's main hero banner photo (Technology.images[0])
// for the new "MEDILASE DUO 808" abdomen-treatment photo. Text is untouched.
//
// Safe to re-run: no-ops once the image is already set.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NEW_HERO_IMAGE = "/media/clinic/laser/laser-hero-medilase-duo-808.png";

async function main() {
  const technology = await prisma.technology.findUnique({
    where: { slug: "laser" },
    select: { id: true, images: true },
  });
  if (!technology) throw new Error("laser technology not found");

  const changed = technology.images[0] !== NEW_HERO_IMAGE;
  if (changed) {
    await prisma.technology.update({
      where: { id: technology.id },
      data: { images: [NEW_HERO_IMAGE, ...technology.images.slice(1)] },
    });
  }

  console.log(JSON.stringify({ changed, images: [NEW_HERO_IMAGE, ...technology.images.slice(1)] }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
