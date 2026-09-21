// RF page photo refresh, step 2 of the project-wide image update (laser done separately).
//
// Swaps the RF technology's hero banner, overview lead image, and 4 process-
// step images for the clinic-supplied replacements, across all three locale
// bodies (photos aren't language-specific). Also updates the `rf` Service's
// own listing image (home page card + /palvelut/mikroneulanrf), which
// currently shares the exact same old file as the step-3 image.
//
// The two overview *supporting* thumbnails and the closing device-section
// image are left untouched: no matching new photo exists for those yet.
//
// Safe to re-run: each replacement only applies if the old filename is still
// present.
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const locales = ["en", "fi", "ru"] as const satisfies readonly Locale[];

const NEW_HERO_IMAGE = "/media/rf/rf-hero-full-room.jpg";
const NEW_STEP3_IMAGE = "/media/rf/rf-step3-back-treatment.jpg";

/**
 * Unlike laser, RF's three locale bodies were scraped with different image
 * filenames per language even though the photos are the same generic stock
 * shots — so the swap has to be keyed per locale, not by one shared filename.
 * Each list is positional: [overview lead, step 1, step 2, step 3, step 4],
 * matching the identical image order confirmed in all three bodies.
 *
 * The step-3 photo happens to be the same source file as the technology's
 * hero banner in the original scrape, but they get different replacements:
 * the hero uses the wide establishing shot, step 3 uses the back-treatment
 * close-up.
 */
const IMAGE_SWAPS: Record<Locale, Array<{ from: string; to: string }>> = {
  en: [
    { from: "/media/files/land/269/6d97dc012bbbb4c7d5ad782a489e01a7.png", to: "/media/rf/rf-device-detail.jpeg" },
    { from: "/media/files/land/280/f28e71464377d786f853ef1371325d41.jpeg", to: "/media/rf/rf-step1-facial-treatment.jpg" },
    { from: "/media/files/land/280/4786a56a1b037c521fe8acebe5c90a9c.jpeg", to: "/media/rf/rf-step2-hands-skin-texture.jpg" },
    { from: "/media/files/land/280/21b80358547be97456baf00ac6a98ac9.jpeg", to: NEW_STEP3_IMAGE },
    { from: "/media/files/land/280/e1bfe4cdb11c81de4fe6da49e8914239.jpg", to: "/media/rf/rf-step4-client-closeup.jpg" },
  ],
  fi: [
    { from: "/media/files/land/274/abec641044dc89b4f89d7706dd790caf.png", to: "/media/rf/rf-device-detail.jpeg" },
    { from: "/media/files/land/278/cad351ad6a4dfa7093c6f71182ab976b.jpeg", to: "/media/rf/rf-step1-facial-treatment.jpg" },
    { from: "/media/files/land/278/a7ef57737ab8ef2eb7113b70c07c8152.jpeg", to: "/media/rf/rf-step2-hands-skin-texture.jpg" },
    { from: "/media/files/land/278/a922320ee5958be2e94a1a5ee8f71862.jpeg", to: NEW_STEP3_IMAGE },
    { from: "/media/files/land/278/494b71d060df36d33e773d9ea8692edb.jpg", to: "/media/rf/rf-step4-client-closeup.jpg" },
  ],
  ru: [
    { from: "/media/files/land/263/e8e6c3d46507d3e5e5cc4448751d0a67.png", to: "/media/rf/rf-device-detail.jpeg" },
    { from: "/media/files/land/281/07375b06ad19fde09214e59f96da53ce.jpeg", to: "/media/rf/rf-step1-facial-treatment.jpg" },
    { from: "/media/files/land/281/d2d455d2b65c37cc8d37b464532bcf91.jpeg", to: "/media/rf/rf-step2-hands-skin-texture.jpg" },
    { from: "/media/files/land/281/a28f89e68424d07c9051aefed1260d8f.jpeg", to: NEW_STEP3_IMAGE },
    { from: "/media/files/land/281/59673d3406063bf24d46b8ff7514d98c.jpg", to: "/media/rf/rf-step4-client-closeup.jpg" },
  ],
};

async function main() {
  const technology = await prisma.technology.findUnique({
    where: { slug: "rf" },
    include: { contents: true },
  });
  if (!technology) throw new Error("rf technology not found");

  const results: Record<string, Record<string, boolean>> = {};

  for (const locale of locales) {
    const content = technology.contents.find((c) => c.locale === locale);
    if (!content) throw new Error(`rf/${locale} content not found`);

    let body = content.body;
    const changed: Record<string, boolean> = {};
    for (const { from, to } of IMAGE_SWAPS[locale]) {
      const willChange = body.includes(from);
      changed[from] = willChange;
      if (willChange) body = body.replaceAll(from, to);
    }

    if (body !== content.body) {
      await prisma.technologyContent.update({ where: { id: content.id }, data: { body } });
    }
    results[locale] = changed;
  }

  const technologyImagesChanged = technology.images[0] !== NEW_HERO_IMAGE;
  if (technologyImagesChanged) {
    await prisma.technology.update({
      where: { id: technology.id },
      data: { images: [NEW_HERO_IMAGE, ...technology.images.slice(1)] },
    });
  }

  const service = await prisma.service.findUnique({ where: { slug: "rf" } });
  let serviceImageChanged = false;
  if (service) {
    serviceImageChanged = service.images[0] !== NEW_HERO_IMAGE;
    if (serviceImageChanged) {
      await prisma.service.update({
        where: { id: service.id },
        data: { images: [NEW_HERO_IMAGE, ...service.images.slice(1)] },
      });
    }
  }

  console.log(JSON.stringify({ bodies: results, technologyImagesChanged, serviceImageChanged }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
