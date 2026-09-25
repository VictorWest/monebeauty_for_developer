// Client feedback: the men's booking flow showed a woman's photo for laser
// hair removal, since the service only ever had one shared image. Sets the
// men's-specific photo generated for this — displays automatically in the
// booking wizard's service picker whenever "Men" is selected.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MALE_IMAGE = "/media/clinic/laser/laser-men-back-hair-removal.jpg";

async function main() {
  const result = await prisma.service.update({
    where: { slug: "laser" },
    data: { maleImage: MALE_IMAGE },
  });
  console.log("Updated laser.maleImage:", result.maleImage);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
