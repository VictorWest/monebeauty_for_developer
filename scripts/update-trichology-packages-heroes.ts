// Round 2, continued: replaces the two remaining "weird" hero photos.
// Neither had an actual text overlay (checked directly) — Trichology's was a
// mismatched-tone real dermatoscope photo, Packages' was an unrelated
// skincare-product flat lay. New files arrived with their filenames swapped
// relative to content, so this wires them in by what's actually in the
// photo, not what Gemini named the file.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NEW_TRICHOLOGY_HERO = "/media/trichology/hero.jpg";
const NEW_PACKAGES_HERO = "/media/home/packages-hero.jpg";

async function main() {
  const technology = await prisma.technology.findUnique({ where: { slug: "trichology" } });
  if (!technology) throw new Error("trichology technology not found");
  const trichologyChanged = technology.images[0] !== NEW_TRICHOLOGY_HERO;
  if (trichologyChanged) {
    await prisma.technology.update({
      where: { id: technology.id },
      data: { images: [NEW_TRICHOLOGY_HERO, ...technology.images.slice(1)] },
    });
  }

  const service = await prisma.service.findUnique({ where: { slug: "packages" } });
  if (!service) throw new Error("packages service not found");
  const packagesChanged = service.images[0] !== NEW_PACKAGES_HERO;
  if (packagesChanged) {
    await prisma.service.update({
      where: { id: service.id },
      data: { images: [NEW_PACKAGES_HERO, ...service.images.slice(1)] },
    });
  }

  console.log(JSON.stringify({ trichologyChanged, packagesChanged }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
