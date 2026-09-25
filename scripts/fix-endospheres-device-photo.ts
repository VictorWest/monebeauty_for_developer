// Legal-compliance fix: the client sent real on-site photos of their actual
// Endospheres device (console + two handpieces) — a completely different
// form factor from the "rotating silicone sphere roller" every existing
// photo showed (that generic Endospheres-brand marketing imagery predates
// this project; it was already wrong in the original scraped site). This
// swaps the last DB-driven reference — the endospheres-branded stock photo
// used by the (hidden, bookingPickerVisible:false) duration-tier stub
// services — for the new real device photo. Every other Endospheres image
// on the site is a plain file swap (same filename, new content), so no
// further DB/markdown changes are needed — see the file overwrites in this
// same commit.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUGS = [
  "endospheres",
  "endospheres-30",
  "endospheres-45",
  "endospheres-60",
  "endospheres-75",
  "endospheres-intro-75",
];

const NEW_IMAGE = "/media/clinic/endospheres/endospheres-device-real.jpg";

async function main() {
  const result = await prisma.service.updateMany({
    where: { slug: { in: SLUGS } },
    data: { images: [NEW_IMAGE] },
  });
  console.log(`Updated ${result.count} services to`, NEW_IMAGE);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
