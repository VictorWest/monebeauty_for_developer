// Round 3: the Silver Membership Card was still a 6-paragraph block against
// the Gift Certificate cards' one clean sentence, so they never matched in
// height even with line-clamp. Rewrites it to one sentence and shortens the
// Gift Certificate description further, for real uniformity across the grid.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REPLACEMENTS: Array<{ from: string; to: string }> = [
  {
    // Note the non-breaking space ( ) between "Membership" and "Card".
    from: "The **MONE Silver Membership Card**\n\nis an easy way to save on every visit.\n\nThe card gives you **5% off all treatments**, works immediately after purchase, and can also be given as a gift.\n\nAfter **20 visits using the Silver Card**, it automatically **upgrades to Gold**, increasing your discount to **10%** — with no extra cost or requirements.\n\nBeauty is even better when it comes with rewards.",
    to: "5% off every visit, automatically upgrading to 10% Gold status after 20 visits — no extra cost.",
  },
  {
    from: "Give your loved ones the gift of care and relaxation. Choose any procedure from our list, and we'll prepare a certificate ready to present — an elegant, personal way to share true self-care.",
    to: "A gift certificate for any treatment on our list — an elegant way to share true self-care.",
  },
];

async function main() {
  const page = await prisma.contentPage.findFirst({ where: { slug: "services/gift-cards", locale: "en" } });
  if (!page) throw new Error("services/gift-cards/en page not found");

  let body = page.body;
  const results: Record<string, number> = {};
  for (const { from, to } of REPLACEMENTS) {
    const occurrences = body.split(from).length - 1;
    results[to.slice(0, 40)] = occurrences;
    body = body.replaceAll(from, to);
  }

  if (body !== page.body) {
    await prisma.contentPage.update({ where: { id: page.id }, data: { body } });
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
