// One-off: laserkarvanpoisto page redesign, step 3 (new photography).
//
// Swaps five image references inside the laser Technology's body markdown:
// the four process-step photos (now shown in the procedure slider) and the
// overview section's lead photo. These are plain photographs with no
// language-specific content, so the swap applies to all three locale bodies
// (unlike the header text/card text steps, which only had English copy
// supplied). The three overview gallery thumbnails (face/bikini/full-leg)
// are untouched — no replacements were supplied for those.
//
// Safe to re-run: each replacement only applies if the old filename is still
// present, so a second run is a no-op.
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const locales = ["en", "fi", "ru"] as const satisfies readonly Locale[];

const IMAGE_SWAPS: Array<{ from: string; to: string }> = [
  {
    // The markdown's forearm reference sits before the "# Laser Hair Removal"
    // h1 and is dropped by parseTechnologyMarkdown's intro filter, so it never
    // rendered anywhere; the overview cluster's actual lead photo is this one.
    from: "/media/clinic/laser/laser-face-hair-removal.jpeg",
    to: "/media/clinic/laser/laser-overview-treatment-room.jpeg",
  },
  {
    from: "/media/clinic/laser/laser-neck-hair-removal.jpeg",
    to: "/media/clinic/laser/laser-consultation-and-skin-preparation.jpeg",
  },
  {
    from: "/media/clinic/laser/laser-underarm-hair-removal.jpeg",
    to: "/media/clinic/laser/laser-application-of-protective-gel.jpeg",
  },
  {
    from: "/media/clinic/laser/laser-lower-body-hair-removal.jpeg",
    to: "/media/clinic/laser/laser-medilase-duo-pro-treatment.jpeg",
  },
  {
    from: "/media/clinic/laser/laser-chin-hair-removal.jpeg",
    to: "/media/clinic/laser/laser-post-treatment-care.jpeg",
  },
];

async function main() {
  const technology = await prisma.technology.findUnique({
    where: { slug: "laser" },
    include: { contents: true },
  });
  if (!technology) throw new Error("laser technology not found");

  const results: Record<string, Record<string, boolean>> = {};

  for (const locale of locales) {
    const content = technology.contents.find((c) => c.locale === locale);
    if (!content) throw new Error(`laser/${locale} content not found`);

    let body = content.body;
    const changed: Record<string, boolean> = {};
    for (const { from, to } of IMAGE_SWAPS) {
      const willChange = body.includes(from);
      changed[from] = willChange;
      if (willChange) body = body.replaceAll(from, to);
    }

    if (body !== content.body) {
      await prisma.technologyContent.update({
        where: { id: content.id },
        data: { body },
      });
    }
    results[locale] = changed;
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
