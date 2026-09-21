// Facial page photo refresh, final step of this project-wide image pass.
// Swaps the Facial service's hero image for the clinic-supplied photo (the
// same photo already used on the home page's Face teaser and RF's step 1 —
// it's the one genuinely accurate match for a facial-device treatment).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NEW_IMAGE = "/media/facial/facial-treatment.jpg";

async function main() {
  const service = await prisma.service.findUnique({ where: { slug: "facial" } });
  if (!service) throw new Error("facial service not found");

  const changed = service.images[0] !== NEW_IMAGE;
  if (changed) {
    await prisma.service.update({
      where: { id: service.id },
      data: { images: [NEW_IMAGE, ...service.images.slice(1)] },
    });
  }

  console.log(JSON.stringify({ changed, images: [NEW_IMAGE, ...service.images.slice(1)] }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
