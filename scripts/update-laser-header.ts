// One-off: laserkarvanpoisto page redesign, step 1 (header only).
//
// Replaces the hero banner photo (Technology.images[0]) with the clinic's
// provided collage, and replaces the hero lead paragraph in the English
// markdown body with the clinic's provided copy. The H1 title itself
// ("Laser Hair Removal") is left unchanged — confirmed with the client.
// Finnish/Russian bodies are untouched for now (English-only content was
// provided); they still show the previous lead paragraph until translated.
//
// The lead paragraph is `lib/technology-layout.ts`'s `heroLead`: the first
// plain paragraph before the body's "# Laser Hair Removal" heading. It is
// used only for the hero (excluded from the on-page copy below), so this is
// a single, safe substitution with no duplicate elsewhere on the page.
//
// Safe to re-run (idempotent: matches on the old paragraph, no-ops if it's
// already been replaced).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_HERO_IMAGE = "/media/clinic/laser/laser-hero-collage.jpeg";

const OLD_LEAD =
  "Laser hair removal with the Medilase Duo Pro device is based on the combination of two wavelengths – diode and Alexandrite lasers. This combination allows for effective and safe targeting of the hair follicle, destroying it and preventing further hair growth.";

const NEW_LEAD =
  "Experience the gold standard in hair removal. The Medilase Duo Pro harnesses the revolutionary power of dual-wavelength technology—combining both diode and Alexandrite lasers—to target and neutralize hair follicles at the root.";

async function main() {
  const before = await prisma.technology.findFirst({
    where: { slug: "laser" },
    select: {
      id: true,
      images: true,
      contents: {
        where: { locale: "en" },
        select: { id: true, body: true },
      },
    },
  });
  if (!before) throw new Error("laser technology not found");
  const content = before.contents[0];
  if (!content) throw new Error("laser/en content not found");

  const imagesChanged = before.images[0] !== NEW_HERO_IMAGE;
  await prisma.technology.update({
    where: { id: before.id },
    data: { images: [NEW_HERO_IMAGE, ...before.images.slice(1)] },
  });

  const bodyChanged = content.body.includes(OLD_LEAD);
  const nextBody = content.body.includes(OLD_LEAD)
    ? content.body.replace(OLD_LEAD, NEW_LEAD)
    : content.body;
  if (bodyChanged) {
    await prisma.technologyContent.update({
      where: { id: content.id },
      data: { body: nextBody },
    });
  } else if (!content.body.includes(NEW_LEAD)) {
    throw new Error(
      "Neither the old nor the new hero paragraph was found — body may have changed unexpectedly.",
    );
  }

  const after = await prisma.technology.findFirst({
    where: { slug: "laser" },
    select: {
      images: true,
      contents: { where: { locale: "en" }, select: { body: true } },
    },
  });
  console.log(
    JSON.stringify(
      {
        imagesChanged,
        bodyChanged,
        images: after?.images,
        heroLeadNowMatches: after?.contents[0]?.body.includes(NEW_LEAD),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
