// One-off: laserkarvanpoisto page redesign, step 2 (three treatment cards).
//
// Updates the English card summary for three specific options in the
// "Choose your treatment" grid, matching the clinic-supplied copy. Only the
// three named cards change; the other ~33 options in the grid are untouched,
// and only the English locale is touched (no fi/ru copy was supplied).
//
// Safe to re-run: matches on the old summary text per key, no-ops once a
// card already carries the new copy.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UPDATES: Record<string, string> = {
  "treatment-01": // Upper Lip
    "Safe, precise upper lip laser hair removal destroys hair roots to ensure long-lasting smoothness.",
  "treatment-07": // Full Face
    "Full-face laser hair removal targets every zone—forehead, cheeks, chin, and lip—for flawless, smooth skin.",
  "treatment-32": // Underarms + Bikini Line
    "Achieve flawless, smooth, and well-groomed underarms and bikini line with our advanced combined hair removal treatment.",
};

async function main() {
  const service = await prisma.service.findUnique({ where: { slug: "laser" } });
  if (!service) throw new Error("laser service not found");

  const results: Record<string, { name: string; changed: boolean }> = {};

  for (const [key, summary] of Object.entries(UPDATES)) {
    const option = await prisma.serviceOption.findUnique({
      where: { serviceId_key: { serviceId: service.id, key } },
    });
    if (!option) throw new Error(`service option ${key} not found`);

    const content = await prisma.serviceOptionContent.findUnique({
      where: { optionId_locale: { optionId: option.id, locale: "en" } },
    });
    if (!content) throw new Error(`${key}/en content not found`);

    const changed = content.summary !== summary;
    if (changed) {
      await prisma.serviceOptionContent.update({
        where: { id: content.id },
        data: { summary },
      });
    }
    results[key] = { name: content.name, changed };
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
