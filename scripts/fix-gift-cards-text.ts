// Trims the Gift Certificate description (English only), which repeated
// verbatim across all 5 denominations with a redundant "why/how to buy"
// listicle and a stray trailing "Gift Certificate." artifact from the
// original scrape.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OLD_TEXT =
  "Give your loved ones the gift of care and relaxation!\n\nLooking for the perfect gift for someone special? We have a great offer – a gift certificate for any procedure from our list. Choose a service and gift your loved ones moments of true relaxation and self-care.\n\nWhy choose a gift certificate?\n\nPersonalized care: You can select a specific procedure that perfectly suits your loved one. Simplicity and convenience: A gift certificate is an elegant way to give care and attention. Create a special moment: Allow your loved ones to experience true pleasure and self-care. How to purchase?\n\nChoose a procedure from our list of services. Contact us in a way that is convenient for you: by phone, via messaging apps, or through our website. Receive a gift certificate ready to be presented. Gift your loved ones true pleasure and care.\n\nDon't hesitate, choose a gift that will leave unforgettable memories!Gift Certificate.";

const NEW_TEXT =
  "Give your loved ones the gift of care and relaxation. Choose any procedure from our list, and we'll prepare a certificate ready to present — an elegant, personal way to share true self-care.";

async function main() {
  const page = await prisma.contentPage.findFirst({ where: { slug: "services/gift-cards", locale: "en" } });
  if (!page) throw new Error("services/gift-cards/en page not found");

  const occurrences = page.body.split(OLD_TEXT).length - 1;
  const body = page.body.replaceAll(OLD_TEXT, NEW_TEXT);
  if (body !== page.body) {
    await prisma.contentPage.update({ where: { id: page.id }, data: { body } });
  }

  console.log(JSON.stringify({ occurrencesReplaced: occurrences }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
