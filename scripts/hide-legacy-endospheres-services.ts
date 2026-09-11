// One-off correction: prisma/seed.ts creates five legacy per-duration
// Endospheres services (endospheres-intro-75/30/45/60/75) whose real content
// now lives as options under the "endospheres" parent service (see
// lib/endospheres-booking-options.ts). The seed data never marked them
// `bookingPickerVisible: false` like the parent, so they showed up as five
// dead-end cards at the front of the public booking picker (options.length
// is 0, so clicking one just re-rendered the picker with nothing selected).
//
// They also stayed `published: true` with no `publicPath` — meaning they
// have no real page anywhere, but still feed the chatbot's knowledge base
// (lib/chat-knowledge.ts's getPublishedServices doesn't check
// bookingPickerVisible). Sitting at the lowest `order` value, they sort to
// the very front of the knowledge list and win scoring ties against genuinely
// relevant content, which is why the assistant kept citing "Endospheres
// Therapy — 30/45/60 min" as its source for unrelated laser and address
// questions. Hiding them from the picker and unpublishing them from content
// both correct the same underlying duplicate-data problem.
//
// Safe to re-run (idempotent) and touches only these five known slugs.
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
    select: { slug: true, bookingPickerVisible: true, published: true },
  });
  const result = await prisma.service.updateMany({
    where: { slug: { in: LEGACY_SLUGS } },
    data: { bookingPickerVisible: false, published: false },
  });
  const after = await prisma.service.findMany({
    where: { slug: { in: LEGACY_SLUGS } },
    select: { slug: true, bookingPickerVisible: true, published: true },
  });
  console.log(JSON.stringify({ before, updated: result.count, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
