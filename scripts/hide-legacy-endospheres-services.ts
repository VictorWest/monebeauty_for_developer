// One-off correction: prisma/seed.ts creates five legacy per-duration
// Endospheres services (endospheres-intro-75/30/45/60/75) whose real content
// now lives as options under the "endospheres" parent service (see
// lib/endospheres-booking-options.ts). The seed data never marked them
// `bookingPickerVisible: false` like the parent, so they show up as five
// dead-end cards at the front of the public service picker (options.length
// is 0, so clicking one just re-renders the picker with nothing selected).
// This hides them the same way the parent is already hidden. Safe to re-run
// (idempotent) and touches only these five known slugs.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LEGACY_SLUGS = [
  "endospheres-intro-75",
  "endospheres-30",
  "endospheres-45",
  "endospheres-60",
  "endospheres-75",
];

async function main() {
  const before = await prisma.service.findMany({
    where: { slug: { in: LEGACY_SLUGS } },
    select: { slug: true, bookingPickerVisible: true },
  });
  const result = await prisma.service.updateMany({
    where: { slug: { in: LEGACY_SLUGS } },
    data: { bookingPickerVisible: false },
  });
  const after = await prisma.service.findMany({
    where: { slug: { in: LEGACY_SLUGS } },
    select: { slug: true, bookingPickerVisible: true },
  });
  console.log(JSON.stringify({ before, updated: result.count, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
