// Round 3: aggressive, uniform shortening of card summaries across Facial,
// Endospheres, Trichology, and Packages — round 2 trimmed the worst
// outliers, but the client wants every card at roughly the same short
// length, not just the outliers brought closer to the pack. Also catches
// endospheres-intro-75 (the featured offer card), which round 2 missed
// entirely — it was still the original ~530-character paragraph.
//
// Paired with line-clamp-2/3 added to the card components in this same
// change, so height stays uniform going forward even if a future edit runs
// a little long — this pass is about the actual text, that one's the
// permanent backstop.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FACIAL: Record<string, string> = {
  "treatment-01": "A personalized skin assessment to build your ideal care and treatment plan.",
  "treatment-02": "Vibrating sphere rollers for anti-aging, therapeutic facial rejuvenation.",
  "treatment-03": "Deep cleansing to clear impurities, reduce pores, and prevent breakouts.",
  "treatment-04": "Personalized care with Israeli Shor cosmetics, from cleansing to lifting.",
  "treatment-05": "A gentle two-phase peel that exfoliates while boosting collagen production.",
  "treatment-06": "A chemical peel for deep renewal, improving skin texture and tone.",
  "treatment-07": "A next-gen peel with a biorevitalizing effect — no injections, no downtime.",
  "treatment-08": "Microneedling with meso-cocktails to renew texture without injections.",
  "treatment-09": "Injectable contouring that reduces fat around the chin, cheeks, and jawline.",
  "treatment-10": "Hyaluronic acid fillers for fuller, well-defined, naturally hydrated lips.",
  "treatment-11": "Hyaluronic acid fillers to restore volume and refine facial proportions.",
  "treatment-12": "PDO and Aptos threads lift and tighten skin while stimulating collagen.",
  "treatment-13": "An injectable biorevitalizer for deep hydration and natural radiance.",
  "treatment-14": "A long-lasting hyaluronic acid implant for denser, smoother-looking skin.",
  "treatment-15": "The first liquid PCL filler, stimulating collagen across the whole face.",
  "treatment-16": "Polynucleotide-peptide injections for a natural lift without surgery.",
  "treatment-17": "A hydrating injectable cocktail for radiant, rejuvenated skin.",
  "treatment-18": "A biomimetic-peptide biorevitalizer for deep restoration and hydration.",
  "treatment-19": "A polynucleotide biostimulator for natural lifting and elasticity.",
  "treatment-20": "An injectable biostimulator that restores structure and collagen.",
  "treatment-21": "Precise, non-invasive papilloma removal using the PlasmaPen device.",
  "treatment-22": "Micro-current therapy that tones muscles and boosts circulation.",
};

const ENDOSPHERES: Record<string, string> = {
  "endospheres-intro-75": "The complete 75-minute full-body protocol — your first, most thorough Endospheres session.",
  "endospheres-30": "A focused 30-minute session for one area, kick-starting circulation and lymphatic flow.",
  "endospheres-45": "45 minutes to treat multiple areas or go deeper on one, for visible early results.",
  "endospheres-60": "Our most popular session — full coverage with real, lasting improvement.",
  "endospheres-75": "The complete full-body protocol for maximum coverage and results.",
};

const TRICHOLOGY: Record<string, string> = {
  "treatment-01": "A camera-based scalp and hair assessment with personalized care recommendations.",
  "treatment-02": "Light therapy that stimulates follicles and calms scalp irritation.",
  "treatment-03": "A deep-cleansing peel, chosen to match your scalp's specific needs.",
  "treatment-04": "Nutrient injections that nourish follicles and reduce hair loss.",
  "treatment-05": "An intensive treatment that strengthens follicles and hair structure.",
};

const PACKAGES: Record<string, string> = {
  "reset-course": "A course of Endospheres RESET sessions to prepare skin before targeted treatment.",
  "endospheres-30-6": "6 sessions of 30-minute Endospheres therapy for one area.",
  "endospheres-30-12": "12 sessions of 30-minute Endospheres therapy for one area.",
  "endospheres-45-6": "6 sessions of 45-minute Endospheres therapy for deeper results.",
  "endospheres-45-12": "12 sessions of 45-minute Endospheres therapy for deeper results.",
  "endospheres-60-6": "6 sessions of our most popular 60-minute Endospheres protocol.",
  "endospheres-60-12": "12 sessions of our most popular 60-minute Endospheres protocol.",
  "endospheres-75-6": "6 sessions of the complete 75-minute full-body protocol.",
  "endospheres-75-12": "12 sessions of the complete 75-minute full-body protocol.",
  "arosha-wrap-6": "6 AROSHA body wrap sessions for cumulative, lasting results.",
  "arosha-wrap-12": "12 AROSHA body wrap sessions for cumulative, lasting results.",
  "endospheres-face-care-6": "6 sessions combining Endospheres therapy with nourishing facial care.",
  "fractional-mesotherapy-5": "A 5-session microneedling mesotherapy course for deeper skin renewal.",
  "laser-upper-lip-chin-5": "5 laser sessions for the upper lip and chin.",
  "laser-upper-lip-chin-10": "10 laser sessions for the upper lip and chin.",
  "laser-underarms-bikini-line-5": "5 laser sessions for underarms and bikini line.",
  "laser-underarms-bikini-line-10": "10 laser sessions for underarms and bikini line.",
  "laser-underarms-brazilian-5": "5 laser sessions for underarms and Brazilian bikini.",
  "laser-underarms-brazilian-10": "10 laser sessions for underarms and Brazilian bikini.",
  "laser-brazilian-full-legs-5": "5 laser sessions for Brazilian bikini and full legs.",
  "laser-brazilian-full-legs-10": "10 laser sessions for Brazilian bikini and full legs.",
  "laser-underarms-brazilian-full-legs-5": "5 laser sessions for underarms, Brazilian bikini, and full legs.",
  "laser-underarms-brazilian-full-legs-10": "10 laser sessions for underarms, Brazilian bikini, and full legs.",
  "laser-full-body-5": "5 full-body laser hair removal sessions.",
  "laser-full-body-10": "10 full-body laser hair removal sessions.",
};

async function updateSummary(service: string, key: string, summary: string, results: Record<string, boolean>) {
  const option = await prisma.serviceOption.findFirst({ where: { key, service: { slug: service } } });
  if (!option) throw new Error(`${service}/${key} not found`);
  const content = await prisma.serviceOptionContent.findUnique({
    where: { optionId_locale: { optionId: option.id, locale: "en" } },
  });
  if (!content) throw new Error(`${service}/${key}/en content not found`);
  const changed = content.summary !== summary;
  if (changed) await prisma.serviceOptionContent.update({ where: { id: content.id }, data: { summary } });
  results[`${service}/${key}`] = changed;
}

async function main() {
  const results: Record<string, boolean> = {};
  for (const [key, summary] of Object.entries(FACIAL)) await updateSummary("facial", key, summary, results);
  for (const [key, summary] of Object.entries(ENDOSPHERES)) await updateSummary("endospheres", key, summary, results);
  for (const [key, summary] of Object.entries(TRICHOLOGY)) await updateSummary("trichology", key, summary, results);
  for (const [key, summary] of Object.entries(PACKAGES)) await updateSummary("packages", key, summary, results);
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
