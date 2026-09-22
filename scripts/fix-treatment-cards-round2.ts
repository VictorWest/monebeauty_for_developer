// Round 2 of card layout/text fixes, from the client's own site testing.
//
// Root causes found:
// 1. ServiceCourseCards/TechnologyTreatmentCards group options into sections
//    by their `group` field. Several pages had options that should share a
//    group split into their own singleton groups by inconsistent data (a
//    typo, brand names used as the group instead of the category, or
//    one-off packages with no shared bucket) — each singleton renders as a
//    full-width solo card, which reads as "stacked" or "lopsided" next to a
//    proper multi-column grid.
// 2. Endospheres' 4 duration cards (30/45/60/75 min) all share one identical
//    long summary with no early period, so the component's "use the first
//    sentence as the heading" logic grabs the whole paragraph as an
//    oversized <h3> on every card.
// 3. RF and Brows summaries ran noticeably longer/more uneven than their
//    peers elsewhere on the site; trimmed to a consistent one-sentence style.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- 1a. RF: one option's group has a hyphen where the other 14 have a
// space, splitting a clean 14-card grid plus one lonely solo card.
const RF_GROUP_FIX = { key: "treatment-01", from: "Microneedle RF-Lifting", to: "Microneedle RF Lifting" };

// --- 1b. Facial: 11 options use their own brand name as the group (so each
// renders alone), when the group should be the shared category and the
// brand name the specific card title. Swaps name <-> group for these.
const FACIAL_GROUP_NAME_SWAPS: Array<{ key: string; group: string; name: string }> = [
  { key: "treatment-05", group: "Peeling", name: "BioRePeel" },
  { key: "treatment-06", group: "Peeling", name: "Exopeel" },
  { key: "treatment-07", group: "Peeling", name: "PRX-T33" },
  { key: "treatment-13", group: "Biorevitalization", name: "Pink Glow" },
  { key: "treatment-14", group: "Biorevitalization", name: "RRS® HA Long Lasting" },
  { key: "treatment-15", group: "Biorevitalization", name: "GOURI" },
  { key: "treatment-16", group: "Biorevitalization", name: "Miracle Facelift" },
  { key: "treatment-17", group: "Biorevitalization", name: "Revofil Aquashine" },
  { key: "treatment-18", group: "Biorevitalization", name: "GemVous" },
  { key: "treatment-19", group: "Biorevitalization", name: "INFINI" },
  { key: "treatment-20", group: "Biorevitalization", name: "KARISMA" },
];

// --- 1c. Brows: "Lash Lamination" is the only option with its own group;
// clearing it joins the other 5 in the shared ungrouped section.
const BROWS_GROUP_CLEAR = { key: "treatment-01" };

// --- 1d. Packages: 3 one-off packages, each in its own singleton group,
// consolidated under one shared "Featured Packages" section.
const PACKAGES_GROUP_CONSOLIDATE = {
  keys: ["reset-course", "endospheres-face-care-6", "fractional-mesotherapy-5"],
  group: "Featured Packages",
};

// --- 2. Endospheres: short, distinct lead sentence per duration (was one
// identical 470-character paragraph on all 4 cards).
const ENDOSPHERES_SUMMARY_FIXES: Record<string, string> = {
  "endospheres-30": "A focused 30-minute session for a single area. Endospheres Therapy®'s Compressive Microvibration® improves lymphatic drainage and circulation from the first visit.",
  "endospheres-45": "45 minutes to work multiple areas or go deeper on one. Restores healthy tissue function through the body's own circulatory and lymphatic processes.",
  "endospheres-60": "Our most popular session — full coverage with visible results. Improves body contours by restoring proper circulation, lymphatic flow, and tissue metabolism.",
  "endospheres-75": "The complete 75-minute full-body protocol. Maximum coverage for lasting improvements in circulation, tissue tone, and body contours.",
};

// --- RF: trim all 15 to one consistent sentence.
const RF_SUMMARY_FIXES: Record<string, string> = {
  "treatment-01": "Microneedle RF lifting combines radiofrequency energy with microneedling to firm, smooth, and rejuvenate the skin without surgery.",
  "treatment-02": "Microneedle RF lifting for the forehead smooths expression lines and restores density, leaving skin firmer and more youthful.",
  "treatment-03": "A gentle microneedle RF treatment for the delicate eye area, reducing fine lines and fatigue for a refreshed look.",
  "treatment-04": "Microneedle RF lifting for the cheeks restores firmness, reduces sagging, and evens out skin texture.",
  "treatment-05": "Microneedle RF lifting refines the chin and jawline, restoring clear, lifted facial contours.",
  "treatment-06": "Microneedle RF lifting for the neck combats sagging and wrinkles, boosting collagen for firmer, denser skin.",
  "treatment-07": "Microneedle RF lifting restores elasticity to the décolleté, reducing wrinkles and signs of photoaging.",
  "treatment-08": "Microneedle RF lifting for the abdomen combats sagging, loss of tone, and stretch marks.",
  "treatment-09": "Microneedle RF lifting tightens and firms the thighs, improving texture and reducing sagging.",
  "treatment-10": "Microneedle RF lifting strengthens knee skin, improving elasticity and reducing sagging.",
  "treatment-11": "Microneedle RF lifting tightens and firms the buttocks, increasing density and reducing sagging.",
  "treatment-12": "Microneedle RF lifting tightens and firms the skin of the arms and hands.",
  "treatment-13": "Microneedle RF lifting for the face and neck delivers comprehensive rejuvenation and a fresher appearance.",
  "treatment-14": "A comprehensive microneedle RF treatment tightening the face, neck, and décolleté for a pronounced lifting effect.",
  "treatment-15": "A comprehensive microneedle RF treatment tightening and firming the abdomen, thighs, and buttocks.",
};

// --- Brows: trim all 6 to a shorter, more even length.
const BROWS_SUMMARY_FIXES: Record<string, string> = {
  "treatment-01": "VELVET lash lamination gives lashes a natural curl, volume, and rich color while strengthening their structure.",
  "treatment-02": "Brow lamination sets brows into a fuller, well-groomed shape that holds for weeks, with no daily styling.",
  "treatment-03": "Lash and brow lamination together for a complete, low-maintenance eye-area refresh in one visit.",
  "treatment-04": "Safe, long-lasting lash tinting for a rich, expressive color without daily mascara.",
  "treatment-05": "Professional brow shaping and tinting for a clean, defined shape that suits your features.",
  "treatment-06": "Brow shaping and tinting paired with lash tinting for a complete, polished eye-area look.",
};

// --- Packages: light trim on the two longest outliers for closer uniformity.
const PACKAGES_SUMMARY_FIXES: Record<string, string> = {
  "reset-course": "A course of Endospheres RESET sessions to prepare the skin and kick-start circulation before targeted treatment.",
  "fractional-mesotherapy-5": "A 5-session microneedling fractional mesotherapy course for deeper, longer-lasting skin renewal.",
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

  // 1a. RF group typo
  {
    const service = await prisma.service.findUnique({ where: { slug: "rf" } });
    const option = await prisma.serviceOption.findUnique({
      where: { serviceId_key: { serviceId: service!.id, key: RF_GROUP_FIX.key } },
    });
    const content = await prisma.serviceOptionContent.findUnique({
      where: { optionId_locale: { optionId: option!.id, locale: "en" } },
    });
    const changed = content!.group === RF_GROUP_FIX.from;
    if (changed) await prisma.serviceOptionContent.update({ where: { id: content!.id }, data: { group: RF_GROUP_FIX.to } });
    results["rf/treatment-01/group"] = changed;
  }

  // 1b. Facial group/name swaps
  {
    const service = await prisma.service.findUnique({ where: { slug: "facial" } });
    for (const fix of FACIAL_GROUP_NAME_SWAPS) {
      const option = await prisma.serviceOption.findUnique({
        where: { serviceId_key: { serviceId: service!.id, key: fix.key } },
      });
      const content = await prisma.serviceOptionContent.findUnique({
        where: { optionId_locale: { optionId: option!.id, locale: "en" } },
      });
      const changed = content!.group !== fix.group || content!.name !== fix.name;
      if (changed) {
        await prisma.serviceOptionContent.update({
          where: { id: content!.id },
          data: { group: fix.group, name: fix.name },
        });
      }
      results[`facial/${fix.key}/group+name`] = changed;
    }
  }

  // 1c. Brows group clear
  {
    const service = await prisma.service.findUnique({ where: { slug: "brows" } });
    const option = await prisma.serviceOption.findUnique({
      where: { serviceId_key: { serviceId: service!.id, key: BROWS_GROUP_CLEAR.key } },
    });
    const content = await prisma.serviceOptionContent.findUnique({
      where: { optionId_locale: { optionId: option!.id, locale: "en" } },
    });
    const changed = content!.group !== null;
    if (changed) await prisma.serviceOptionContent.update({ where: { id: content!.id }, data: { group: null } });
    results["brows/treatment-01/group"] = changed;
  }

  // 1d. Packages group consolidation
  {
    const service = await prisma.service.findUnique({ where: { slug: "packages" } });
    for (const key of PACKAGES_GROUP_CONSOLIDATE.keys) {
      const option = await prisma.serviceOption.findUnique({
        where: { serviceId_key: { serviceId: service!.id, key } },
      });
      const content = await prisma.serviceOptionContent.findUnique({
        where: { optionId_locale: { optionId: option!.id, locale: "en" } },
      });
      const changed = content!.group !== PACKAGES_GROUP_CONSOLIDATE.group;
      if (changed) {
        await prisma.serviceOptionContent.update({
          where: { id: content!.id },
          data: { group: PACKAGES_GROUP_CONSOLIDATE.group },
        });
      }
      results[`packages/${key}/group`] = changed;
    }
  }

  // 2 + text trims
  for (const [key, summary] of Object.entries(ENDOSPHERES_SUMMARY_FIXES)) {
    await updateSummary("endospheres", key, summary, results);
  }
  for (const [key, summary] of Object.entries(RF_SUMMARY_FIXES)) {
    await updateSummary("rf", key, summary, results);
  }
  for (const [key, summary] of Object.entries(BROWS_SUMMARY_FIXES)) {
    await updateSummary("brows", key, summary, results);
  }
  for (const [key, summary] of Object.entries(PACKAGES_SUMMARY_FIXES)) {
    await updateSummary("packages", key, summary, results);
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
