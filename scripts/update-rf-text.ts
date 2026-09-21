// RF page text refresh: adds the treatment-course and results-duration facts
// from the clinic's original site (monebeauty.fi), which weren't in the
// migrated copy. English-only, since no translated version was sourced.
// A single sentence appended to the existing paragraph, not a new section —
// keeps the page's existing structure intact.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OLD_PARAGRAPH =
  "A key advantage of microneedling RF lifting is the **gradual and long-lasting improvement** over 1–3 months following the procedure.\nThe body naturally forms a new collagen framework — resulting in a **natural, long-lasting effect** without an over-treated look.";

const NEW_PARAGRAPH =
  "A key advantage of microneedling RF lifting is the **gradual and long-lasting improvement** over 1–3 months following the procedure.\nThe body naturally forms a new collagen framework — resulting in a **natural, long-lasting effect** without an over-treated look. A typical course involves **3–5 sessions spaced 3–6 weeks apart**, with the effect continuing to build for **up to 12 months**.";

async function main() {
  const content = await prisma.technologyContent.findFirst({
    where: { technology: { slug: "rf" }, locale: "en" },
  });
  if (!content) throw new Error("rf/en content not found");

  const changed = content.body.includes(OLD_PARAGRAPH);
  if (changed) {
    await prisma.technologyContent.update({
      where: { id: content.id },
      data: { body: content.body.replace(OLD_PARAGRAPH, NEW_PARAGRAPH) },
    });
  } else if (!content.body.includes(NEW_PARAGRAPH)) {
    throw new Error("Neither the old nor the new paragraph was found — body may have changed unexpectedly.");
  }

  console.log(JSON.stringify({ changed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
