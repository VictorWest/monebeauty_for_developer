// Arosha page photo refresh: hero, one supporting image, and the closing
// image, keyed per locale (fi/ru use different source filenames for the
// hero and closing photos than English; the supporting photo is shared).
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();
const locales = ["en", "fi", "ru"] as const satisfies readonly Locale[];

// Positional: [hero, supporting, closing]
const IMAGE_SWAPS: Record<Locale, Array<{ from: string; to: string }>> = {
  en: [
    { from: "/media/files/land/133/f455ec435b437295b753f2eae3c32488.jpg", to: "/media/arosha/hero.jpg" },
    { from: "/media/files/land/133/aee24846322a462b149cee1d4c9fbdb9.jpg", to: "/media/arosha/supporting.jpg" },
    { from: "/media/files/land/238/b82f4461170d37567be9f00e32c87791.jpg", to: "/media/arosha/closing.jpg" },
  ],
  fi: [
    { from: "/media/files/land/178/c0da0fcbc90b66f3bc03029c2c651aa4.jpeg", to: "/media/arosha/hero.jpg" },
    { from: "/media/files/land/133/aee24846322a462b149cee1d4c9fbdb9.jpg", to: "/media/arosha/supporting.jpg" },
    { from: "/media/files/land/237/290c3a3871a715cc30378e5ddec95ece.jpg", to: "/media/arosha/closing.jpg" },
  ],
  ru: [
    { from: "/media/files/land/133/f455ec435b437295b753f2eae3c32488.jpg", to: "/media/arosha/hero.jpg" },
    { from: "/media/files/land/133/aee24846322a462b149cee1d4c9fbdb9.jpg", to: "/media/arosha/supporting.jpg" },
    { from: "/media/files/land/236/5d1b00b15378e31722c866830c4d11b0.jpg", to: "/media/arosha/closing.jpg" },
  ],
};

async function main() {
  const results: Record<string, Record<string, boolean>> = {};
  for (const locale of locales) {
    const page = await prisma.contentPage.findFirst({ where: { slug: "arosha", locale } });
    if (!page) throw new Error(`arosha/${locale} page not found`);

    let body = page.body;
    const changed: Record<string, boolean> = {};
    for (const { from, to } of IMAGE_SWAPS[locale]) {
      const willChange = body.includes(from);
      changed[from] = willChange;
      if (willChange) body = body.replaceAll(from, to);
    }
    if (body !== page.body) {
      await prisma.contentPage.update({ where: { id: page.id }, data: { body } });
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
