// Trichology page photo refresh: overview + 4 process-step images (body
// markdown, keyed per locale — same hashes as English, just different folder
// numbers, but matched explicitly per locale for safety).
//
// No new photo was supplied for the closing device shot or the technology
// hero, so both are left untouched.
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const locales = ["en", "fi", "ru"] as const satisfies readonly Locale[];

// Positional: [overview lead, overview support A, overview support B, step 1, step 2, step 3, step 4]
const IMAGE_SWAPS: Record<Locale, Array<{ from: string; to: string }>> = {
  en: [
    { from: "/media/files/land/303/fb364d611074112e8e9cdf3880b1369f.jpg", to: "/media/trichology/overview-lead.jpg" },
    { from: "/media/files/land/303/8b2e9288e47ba7705d700a8d7edb596e.jpeg", to: "/media/trichology/overview-support-a.jpg" },
    { from: "/media/files/land/303/5e7135aaffc757abe7dd5f3cb263e823.jpg", to: "/media/trichology/overview-support-b.jpg" },
    { from: "/media/files/land/306/bfca375187e93879cc68aca916cb67a0.jpg", to: "/media/trichology/step1-analysis.jpg" },
    { from: "/media/files/land/306/2d55939f6cbc01f974408a78fe8485f4.jpg", to: "/media/trichology/step2-led-therapy.jpg" },
    { from: "/media/files/land/306/46309f5a050f9914f6ad7808e9e397eb.jpg", to: "/media/trichology/step3-peeling.jpg" },
    { from: "/media/files/land/306/ef5613b18e6f018cd818a1b507c3bd22.png", to: "/media/trichology/step4-mesotherapy.jpg" },
  ],
  fi: [
    { from: "/media/files/land/302/fb364d611074112e8e9cdf3880b1369f.jpg", to: "/media/trichology/overview-lead.jpg" },
    { from: "/media/files/land/302/8b2e9288e47ba7705d700a8d7edb596e.jpeg", to: "/media/trichology/overview-support-a.jpg" },
    { from: "/media/files/land/302/5e7135aaffc757abe7dd5f3cb263e823.jpg", to: "/media/trichology/overview-support-b.jpg" },
    { from: "/media/files/land/304/bfca375187e93879cc68aca916cb67a0.jpg", to: "/media/trichology/step1-analysis.jpg" },
    { from: "/media/files/land/304/2d55939f6cbc01f974408a78fe8485f4.jpg", to: "/media/trichology/step2-led-therapy.jpg" },
    { from: "/media/files/land/304/46309f5a050f9914f6ad7808e9e397eb.jpg", to: "/media/trichology/step3-peeling.jpg" },
    { from: "/media/files/land/304/ef5613b18e6f018cd818a1b507c3bd22.png", to: "/media/trichology/step4-mesotherapy.jpg" },
  ],
  ru: [
    { from: "/media/files/land/296/fb364d611074112e8e9cdf3880b1369f.jpg", to: "/media/trichology/overview-lead.jpg" },
    { from: "/media/files/land/296/8b2e9288e47ba7705d700a8d7edb596e.jpeg", to: "/media/trichology/overview-support-a.jpg" },
    { from: "/media/files/land/296/5e7135aaffc757abe7dd5f3cb263e823.jpg", to: "/media/trichology/overview-support-b.jpg" },
    { from: "/media/files/land/298/bfca375187e93879cc68aca916cb67a0.jpg", to: "/media/trichology/step1-analysis.jpg" },
    { from: "/media/files/land/298/2d55939f6cbc01f974408a78fe8485f4.jpg", to: "/media/trichology/step2-led-therapy.jpg" },
    { from: "/media/files/land/298/46309f5a050f9914f6ad7808e9e397eb.jpg", to: "/media/trichology/step3-peeling.jpg" },
    { from: "/media/files/land/298/ef5613b18e6f018cd818a1b507c3bd22.png", to: "/media/trichology/step4-mesotherapy.jpg" },
  ],
};

async function main() {
  const technology = await prisma.technology.findUnique({
    where: { slug: "trichology" },
    include: { contents: true },
  });
  if (!technology) throw new Error("trichology technology not found");

  const results: Record<string, Record<string, boolean>> = {};
  for (const locale of locales) {
    const content = technology.contents.find((c) => c.locale === locale);
    if (!content) throw new Error(`trichology/${locale} content not found`);

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

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
