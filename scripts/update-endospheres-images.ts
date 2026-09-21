// Endospheres page photo refresh: technology hero, the two flagship-page
// editorial images, and the technology page's own overview/step/closing
// images (body markdown, keyed per locale — like RF, Endospheres' locale
// bodies use different source filenames per language).
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const locales = ["en", "fi", "ru"] as const satisfies readonly Locale[];

const NEW_HERO_IMAGE = "/media/endospheres/hero.jpg";

const EDITORIAL_UPDATES: Record<string, string> = {
  "endospheres.editorial.1": "/media/endospheres/editorial-1.jpg",
  "endospheres.editorial.2": "/media/endospheres/editorial-2.jpg",
};

// Positional per body: [overview lead, overview support A, overview support B,
// step 1, step 2, step 3, step 4, closing device]. The dead pre-h1 intro image
// is left alone (never rendered, per parseTechnologyMarkdown).
const IMAGE_SWAPS: Record<Locale, Array<{ from: string; to: string }>> = {
  en: [
    { from: "/media/files/land/104/8c6f2e75d8051e304bca2fd6f22fa512.jpg", to: "/media/endospheres/overview-lead.jpg" },
    { from: "/media/files/land/104/760bda4adade7e51ab613436640590b3.jpg", to: "/media/endospheres/overview-support-a.jpg" },
    { from: "/media/files/land/84/bb323512c6de0a7a8d0695f9be57461c.jpg", to: "/media/endospheres/overview-support-b.jpg" },
    { from: "/media/files/land/99/e0e1d71833938c1a93b8b48246cfda7e.jpg", to: "/media/endospheres/step1-consultation.jpg" },
    { from: "/media/files/land/99/632cfb5b6ffa46a890fc91a327f79a3f.jpg", to: "/media/endospheres/step2-device-application.jpg" },
    { from: "/media/files/land/99/0b0d7a710b2bf2b774dce0dee98eca13.jpg", to: "/media/endospheres/step3-treatment.jpg" },
    { from: "/media/files/land/99/e03dced6f955d3b70db4f5bb9fd5a61c.jpg", to: "/media/endospheres/step4-aftercare.jpg" },
    { from: "/media/files/land/100/0397dd6e1352c756a1a0ca523f7d12a6.jpg", to: "/media/endospheres/closing-device.jpg" },
  ],
  fi: [
    { from: "/media/files/land/84/338ad3c015bc61a8aea2b2c146497c2c.jpg", to: "/media/endospheres/overview-lead.jpg" },
    { from: "/media/files/land/84/199253dbecd60b93e1ca2dec8168477a.jpg", to: "/media/endospheres/overview-support-a.jpg" },
    { from: "/media/files/land/84/bb323512c6de0a7a8d0695f9be57461c.jpg", to: "/media/endospheres/overview-support-b.jpg" },
    { from: "/media/files/land/99/e0e1d71833938c1a93b8b48246cfda7e.jpg", to: "/media/endospheres/step1-consultation.jpg" },
    { from: "/media/files/land/99/632cfb5b6ffa46a890fc91a327f79a3f.jpg", to: "/media/endospheres/step2-device-application.jpg" },
    { from: "/media/files/land/99/0b0d7a710b2bf2b774dce0dee98eca13.jpg", to: "/media/endospheres/step3-treatment.jpg" },
    { from: "/media/files/land/99/e03dced6f955d3b70db4f5bb9fd5a61c.jpg", to: "/media/endospheres/step4-aftercare.jpg" },
    { from: "/media/files/land/100/0397dd6e1352c756a1a0ca523f7d12a6.jpg", to: "/media/endospheres/closing-device.jpg" },
  ],
  ru: [
    { from: "/media/files/land/103/4501a4d7bb43f9b657c006bfd589711f.jpg", to: "/media/endospheres/overview-lead.jpg" },
    { from: "/media/files/land/103/96bf62faef1b0e014ffc2eb68604439a.jpg", to: "/media/endospheres/overview-support-a.jpg" },
    { from: "/media/files/land/84/bb323512c6de0a7a8d0695f9be57461c.jpg", to: "/media/endospheres/overview-support-b.jpg" },
    { from: "/media/files/land/99/e0e1d71833938c1a93b8b48246cfda7e.jpg", to: "/media/endospheres/step1-consultation.jpg" },
    { from: "/media/files/land/99/632cfb5b6ffa46a890fc91a327f79a3f.jpg", to: "/media/endospheres/step2-device-application.jpg" },
    { from: "/media/files/land/99/0b0d7a710b2bf2b774dce0dee98eca13.jpg", to: "/media/endospheres/step3-treatment.jpg" },
    { from: "/media/files/land/99/e03dced6f955d3b70db4f5bb9fd5a61c.jpg", to: "/media/endospheres/step4-aftercare.jpg" },
    { from: "/media/files/land/113/30203decacdb1aa0a1787bb364cb7846.jpg", to: "/media/endospheres/closing-device.jpg" },
  ],
};

async function main() {
  const technology = await prisma.technology.findUnique({
    where: { slug: "endospheres" },
    include: { contents: true },
  });
  if (!technology) throw new Error("endospheres technology not found");

  const bodyResults: Record<string, Record<string, boolean>> = {};
  for (const locale of locales) {
    const content = technology.contents.find((c) => c.locale === locale);
    if (!content) throw new Error(`endospheres/${locale} content not found`);

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
    bodyResults[locale] = changed;
  }

  const heroChanged = technology.images[0] !== NEW_HERO_IMAGE;
  if (heroChanged) {
    await prisma.technology.update({
      where: { id: technology.id },
      data: { images: [NEW_HERO_IMAGE, ...technology.images.slice(1)] },
    });
  }

  const editorialResults: Record<string, boolean> = {};
  for (const [key, image] of Object.entries(EDITORIAL_UPDATES)) {
    const slot = await prisma.siteMediaSlot.findUnique({ where: { key } });
    if (!slot) throw new Error(`SiteMediaSlot ${key} not found`);
    const changed = slot.image !== image;
    if (changed) await prisma.siteMediaSlot.update({ where: { key }, data: { image } });
    editorialResults[key] = changed;
  }

  console.log(JSON.stringify({ heroChanged, editorialResults, bodyResults }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
