// Trims the Arosha "SKINCARE PROGRAMS" card texts (English only) for length
// consistency. Three of the seven had a redundant boilerplate paragraph
// ("The third stage of the AROSHA METHOD includes...") repeated ahead of
// their actual description; the two Super Combo entries ran much longer
// than their siblings. Trims each to one tight paragraph.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REPLACEMENTS: Array<{ from: string; to: string }> = [
  {
    from: "The third stage of the AROSHA METHOD includes all procedures aimed at addressing specific skin imperfections such as cellulite, localized fat reduction, and body sculpting.\n\nLIPOFIT is a targeted program for reducing abdominal fat. This lipolytic treatment effectively reduces the volume of problem areas such as the abdomen. Special concentrates are used to activate the metabolism of fat cells and promote fat burning, leading to volume reduction and body shaping.",
    to: "LIPOFIT is a targeted lipolytic program for reducing abdominal fat, using concentrates that activate fat-cell metabolism for visible volume reduction.",
  },
  {
    from: "The third stage of the AROSHA METHOD includes procedures aimed at addressing cellulite, reducing localized fat deposits, and body sculpting.\n\nFIBROCEL+ is a treatment specifically designed to combat skin imperfections caused by advanced stages of cellulite. The high concentration of collagenase in the products breaks down collagen around fat cells, helping to reduce fibrous nodules and smooth \"orange peel\" skin. Ingredients such as caffeine, L-carnitine, and phosphatidylcholine promote the reduction of fat cells and prevent the formation of new ones.",
    to: "FIBROCEL+ targets advanced cellulite: a high-collagenase formula breaks down fibrous nodules and smooths \"orange peel\" skin, with caffeine and L-carnitine to reduce fat cells.",
  },
  {
    from: "The third stage of the AROSHA METHOD includes procedures designed to correct skin imperfections, reduce localized fat deposits, and sculpt the body.\n\nFIRMING KOMPLEKTS is designed to firm and hydrate the skin with a lifting effect. This treatment is especially recommended after weight loss, pregnancy, and breastfeeding. It works well for stretch marks and serves as an effective anti-aging treatment.",
    to: "FIRMING KOMPLEKTS firms and hydrates with a lifting effect — especially effective for stretch marks and skin laxity after weight loss, pregnancy, or breastfeeding.",
  },
  {
    from: "Super Combo 1 is a comprehensive anti-cellulite treatment consisting of two stages. The first stage is a 45-minute Endospheres therapy session targeting the thighs, legs, and abdomen. Endospheres therapy is a non-invasive cellulite treatment that uses mechanical stimulation to improve circulation and lymphatic flow. The second stage is a 35-minute AROSHA anti-cellulite wrap, which helps break down fat deposits and improve skin condition. The wrap does not require rinsing after the procedure. The total duration of the \"Super Combo 1\" program is approximately 1.5 hours. This comprehensive treatment is designed for fast results in reducing cellulite and improving skin smoothness and firmness.",
    to: "A two-stage anti-cellulite treatment: 45 minutes of Endospheres therapy on the thighs, legs, and abdomen, followed by a 35-minute AROSHA anti-cellulite wrap (no rinse needed). About 1.5 hours total, for fast, visible results.",
  },
  {
    from: "This is a professional body detoxification and oxygenation therapy. The treatment exfoliates the epidermis, stimulates skin microcirculation, and enriches tissues with oxygen.\n\nThe treatment includes full-body Endospheres therapy plus an AROSHA Detox wrap. The duration of the procedure is approximately 2 hours, and the wrap does not require rinsing.",
    to: "Full-body Endospheres therapy paired with an AROSHA Detox wrap (no rinse needed) — about 2 hours of exfoliation, oxygenation, and microcirculation support.",
  },
  {
    from: "This treatment provides full body and facial care. First, a 60-minute Endospheres therapy session is performed on the entire body. During the AROSHA body wrap, simultaneous Endospheres therapy is applied to the face, along with a nourishing facial mask. This treatment is designed to sculpt and renew the skin of the body and face, while also providing nourishment and hydration to the facial skin.\n\nThe procedure is intended to shape the body, improve elasticity, and provide adequate hydration with a lifting effect. This series is especially recommended for post-weight loss, pregnancy, and breastfeeding care. It also works well for stretch marks and serves as an anti-aging treatment.",
    to: "Full-body Endospheres therapy and an AROSHA body wrap, plus simultaneous facial Endospheres therapy and a nourishing mask — sculpting and hydrating body and face together. Especially effective for stretch marks and skin laxity after weight loss, pregnancy, or breastfeeding.",
  },
];

async function main() {
  const page = await prisma.contentPage.findFirst({ where: { slug: "arosha", locale: "en" } });
  if (!page) throw new Error("arosha/en page not found");

  let body = page.body;
  const results: Record<string, boolean> = {};
  for (const { from, to } of REPLACEMENTS) {
    const willChange = body.includes(from);
    results[to.slice(0, 40)] = willChange;
    if (willChange) body = body.replace(from, to);
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
