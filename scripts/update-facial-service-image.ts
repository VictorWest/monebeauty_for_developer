// Client feedback: Facial Treatments' photo showed a handheld device against
// a cheek, reading as RF/microcurrent rather than the service as a whole —
// only 2 of Facial's 22 options use any device. Swaps in a hands-only
// skincare application photo instead (new AI-generated asset, matching the
// site's navy-blue-uniform photography set).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_IMAGE = "/media/facial/facial-skincare-application.jpg";

async function main() {
  const result = await prisma.service.update({
    where: { slug: "facial" },
    data: { images: [NEW_IMAGE] },
  });
  console.log(`Updated facial service images:`, result.images);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
