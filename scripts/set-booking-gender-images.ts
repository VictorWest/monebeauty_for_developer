// One-off: sets the two admin-managed booking.gender.* image slots (see
// content/site-media.ts and BookingWizard.tsx's gender step) to portraits
// already live elsewhere on this exact site (the homepage's treatment-area
// section) — same on-brand look, already approved for this business, so
// this introduces no new/unlicensed content. Purely a starting point: swap
// either one for real clinic photography any time from the admin media
// panel, same as any other managed image slot. Safe to re-run (idempotent).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLOTS: Record<string, string> = {
  "booking.gender.women": "/media/home/treatment-areas/face.jpeg",
  "booking.gender.men": "/media/home/treatment-areas/men.png",
};

async function main() {
  const before = await prisma.siteMediaSlot.findMany({
    where: { key: { in: Object.keys(SLOTS) } },
    select: { key: true, image: true },
  });
  for (const [key, image] of Object.entries(SLOTS)) {
    await prisma.siteMediaSlot.upsert({
      where: { key },
      update: { image },
      create: { key, image },
    });
  }
  const after = await prisma.siteMediaSlot.findMany({
    where: { key: { in: Object.keys(SLOTS) } },
    select: { key: true, image: true },
  });
  console.log(JSON.stringify({ before, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
