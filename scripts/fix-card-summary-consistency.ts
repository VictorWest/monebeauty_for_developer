// Text-consistency audit fix (project-wide image/text pass, text phase).
//
// Three problems found in the treatment-card grid (ServiceCourseCards has no
// text truncation — auto-rows-fr means one long card stretches its entire
// row), all confirmed by direct DB inspection:
//
// 1. A handful of options across Facial and Trichology have `summary` values
//    that run 2-4x longer than their siblings, because their original
//    content had an extra explanatory paragraph before the first bulleted
//    section. This trims each one back to just its opening paragraph(s),
//    matching the shorter, correctly-scoped summaries elsewhere. Nothing is
//    lost: `description` (used on the option's own detail page) is untouched.
// 2. Brows "Lash Lamination" (treatment-01) had a `summary` that was just a
//    duration fragment ("Duration of the procedure: 60-90 minutes") despite
//    having a full rich description in the same row. Replaced with the
//    description's real opening paragraph.
// 3. Packages "endospheres-face-care-6" had no English content at all (only
//    fi/ru existed) — translated from the Russian version (which, unlike the
//    Finnish one, actually describes the Endospheres + Face Care combo this
//    option's name and price refer to), formatted to match its sibling
//    English package entries.
//
// Safe to re-run: each write only applies if the current value still matches
// what was found during the audit.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUMMARY_FIXES: Array<{ service: string; key: string; from: string; to: string }> = [
  {
    service: "facial",
    key: "treatment-08",
    from:
      "Italian method of skin rejuvenation and renewal without injections\n\nMicroneedling fractional mesotherapy, also known as microneedling, is an innovative and highly effective procedure based on the Italian method of skin rejuvenation. It is performed using the Dermapen device together with specially selected meso-cocktails. The method activates the skin’s own resources, improves its texture and appearance, without aggressive intervention.\n\n**How the procedure works:**\nDuring the session, the Dermapen device is used — a pen-shaped tool with a tip of ultra-fine sterile needles that create micro-punctures at a depth of 0.4 to 4 mm. These micro-injuries trigger controlled skin micro-trauma, which stimulates natural regeneration processes without damaging the skin.\nAt the same time, individually selected serums or meso-cocktails enriched with active ingredients — vitamins, amino acids, peptides, and hyaluronic acid — are delivered into the skin.",
    to:
      "Italian method of skin rejuvenation and renewal without injections\n\nMicroneedling fractional mesotherapy, also known as microneedling, is an innovative and highly effective procedure based on the Italian method of skin rejuvenation. It is performed using the Dermapen device together with specially selected meso-cocktails. The method activates the skin’s own resources, improves its texture and appearance, without aggressive intervention.",
  },
  {
    service: "facial",
    key: "treatment-14",
    from:
      "**RRS® HA Long Lasting** is a sterile dermal implant (Class III) based on **BDDE-crosslinked, resorbable hyaluronic acid (21 mg / 3 mL)**, stabilized with an amino acid antioxidant buffer. The product is designed to address signs of photoaging, dermal atrophy, and decreased skin quality, in cases where increased skin density and visible smoothing of folds are required.\n\n**How RRS® HA Long Lasting works:**\nThanks to stabilized crosslinked hyaluronic acid, the product provides a pronounced hydrating reservoir and structural skin support. The gradual release technology helps maintain long-lasting results. As a result, key skin parameters such as hydration, turgor, and elasticity improve, while the appearance of wrinkles and skin folds is visibly reduced.",
    to:
      "**RRS® HA Long Lasting** is a sterile dermal implant (Class III) based on **BDDE-crosslinked, resorbable hyaluronic acid (21 mg / 3 mL)**, stabilized with an amino acid antioxidant buffer. The product is designed to address signs of photoaging, dermal atrophy, and decreased skin quality, in cases where increased skin density and visible smoothing of folds are required.",
  },
  {
    service: "facial",
    key: "treatment-13",
    from:
      "**Pink Glow** is an innovative injectable biorevitalization treatment designed to deeply hydrate the skin, improve its overall quality, and restore natural radiance. The formula combines hyaluronic acid, vitamins, amino acids, and antioxidants that work synergistically to enhance skin texture and tone.\n\n**How Pink Glow works:**\nThe product is injected into the superficial and mid-dermal layers of the skin, where it activates cellular metabolism, improves microcirculation, and hydrates tissues with moisture and essential nutrients. Thanks to its brightening and antioxidant properties, Pink Glow effectively combats dull skin tone, signs of fatigue, and early age-related changes. The skin becomes smoother, firmer, and visibly fresher.",
    to:
      "**Pink Glow** is an innovative injectable biorevitalization treatment designed to deeply hydrate the skin, improve its overall quality, and restore natural radiance. The formula combines hyaluronic acid, vitamins, amino acids, and antioxidants that work synergistically to enhance skin texture and tone.",
  },
  {
    service: "facial",
    key: "treatment-17",
    from:
      "Deep hydration, radiance, and anti-aging care in one procedure\n\nAquashine Revofil is a highly effective injectable cocktail designed for active hydration, restoration, and skin rejuvenation. Its formula includes hyaluronic acid, biomimetic peptides, vitamins, amino acids, and coenzymes — everything necessary to restart cellular processes and achieve smooth, radiant skin.\n\n**How Revofil Aquashine works:**\nThe product penetrates into the deep layers of the skin, activating cell metabolism, stimulating collagen and elastin production, evening out skin tone, and improving microrelief. Thanks to the peptide complex, the treatment provides not only hydration but also a lifting effect with tissue strengthening.",
    to:
      "Deep hydration, radiance, and anti-aging care in one procedure\n\nAquashine Revofil is a highly effective injectable cocktail designed for active hydration, restoration, and skin rejuvenation. Its formula includes hyaluronic acid, biomimetic peptides, vitamins, amino acids, and coenzymes — everything necessary to restart cellular processes and achieve smooth, radiant skin.",
  },
  {
    service: "facial",
    key: "treatment-21",
    from:
      "**Fast and precise removal without surgical intervention**\n\nPapilloma removal using the **PlasmaPen device** is a modern non-invasive method for treating benign skin lesions with plasma energy. The procedure allows for precise targeting of the papilloma while minimizing impact on surrounding tissues and preserving skin integrity.\n\n**How PlasmaPen works:**\nThe device generates a controlled plasma arc that acts on the surface of the lesion, causing coagulation and gradual detachment of the papilloma. There is no direct contact with the skin, which reduces the risk of bleeding and infection. The treatment is strictly localized to the papilloma area, ensuring high procedural accuracy.",
    to:
      "**Fast and precise removal without surgical intervention**\n\nPapilloma removal using the **PlasmaPen device** is a modern non-invasive method for treating benign skin lesions with plasma energy. The procedure allows for precise targeting of the papilloma while minimizing impact on surrounding tissues and preserving skin integrity.",
  },
  {
    service: "facial",
    key: "treatment-09",
    from:
      "Non-surgical contouring and reduction of localized fat deposits\n\nFacial lipolytic treatment is an injectable method aimed at reducing localized fat deposits and contouring the facial shape. It is especially effective in the area of the double chin, cheeks, and along the facial contour.\n\n**How the procedure works:**\nLipolytics are specialized formulations based on sodium deoxycholate, phosphatidylcholine, and other active components that trigger the process of lipolysis — the breakdown of fat cells. After the injection, the fat tissue gradually breaks down and is naturally eliminated from the body through the lymphatic system.",
    to:
      "Non-surgical contouring and reduction of localized fat deposits\n\nFacial lipolytic treatment is an injectable method aimed at reducing localized fat deposits and contouring the facial shape. It is especially effective in the area of the double chin, cheeks, and along the facial contour.",
  },
  {
    service: "trichology",
    key: "treatment-02",
    from:
      "LED scalp therapy is a non-invasive treatment based on the use of specific light wavelengths. The procedure stimulates hair follicles, improves scalp microcirculation, and supports overall scalp health. Light therapy helps reduce inflammation, regulate sebaceous gland activity, and activate hair growth.\n\n**Benefits of the treatment:**\n- Stimulates hair growth\n- Improves scalp blood circulation\n- Reduces hair loss\n- Decreases inflammation and irritation\n- Painless and safe procedure",
    to:
      "LED scalp therapy is a non-invasive treatment based on the use of specific light wavelengths. The procedure stimulates hair follicles, improves scalp microcirculation, and supports overall scalp health. Light therapy helps reduce inflammation, regulate sebaceous gland activity, and activate hair growth.",
  },
  {
    service: "trichology",
    key: "treatment-03",
    from:
      "Scalp peeling is a deep cleansing treatment aimed at removing dead skin cells, excess sebum, and impurities. **The peeling is selected individually** based on scalp type, presence of dandruff, sensitivity, and other individual characteristics. The procedure helps normalize sebaceous gland activity, improves microcirculation, and prepares the scalp for subsequent treatments.\n\n**Benefits of the treatment:**\n- Individually selected peeling\n- Deep cleansing of the scalp\n- Regulation of oil balance\n- Reduction of itching and flaking\n- Increased effectiveness of subsequent care",
    to:
      "Scalp peeling is a deep cleansing treatment aimed at removing dead skin cells, excess sebum, and impurities. **The peeling is selected individually** based on scalp type, presence of dandruff, sensitivity, and other individual characteristics. The procedure helps normalize sebaceous gland activity, improves microcirculation, and prepares the scalp for subsequent treatments.",
  },
  {
    service: "trichology",
    key: "treatment-04",
    from:
      "Scalp mesotherapy is an injectable treatment aimed at restoring and strengthening hair by delivering active ingredients directly into the scalp. **Mesotherapy cocktails are selected individually** based on the condition of the scalp, the type of hair loss, and treatment goals. The procedure improves nourishment of hair follicles, stimulates hair growth, and increases hair density.\n\n**Benefits of the treatment:**\n- Individually selected mesotherapy cocktails\n- Intensive nourishment of hair follicles\n- Reduction of hair loss\n- Stimulation of hair growth\n- Improved hair quality and density",
    to:
      "Scalp mesotherapy is an injectable treatment aimed at restoring and strengthening hair by delivering active ingredients directly into the scalp. **Mesotherapy cocktails are selected individually** based on the condition of the scalp, the type of hair loss, and treatment goals. The procedure improves nourishment of hair follicles, stimulates hair growth, and increases hair density.",
  },
  {
    service: "trichology",
    key: "treatment-05",
    from:
      "Hair fillers are an intensive treatment for restoring scalp and hair health, aimed at strengthening hair follicles, improving hair structure, and stimulating hair growth. Active ingredients help replenish nutrient deficiencies and enhance hair quality from within.\n\n**Benefits of the treatment:**\n- Intensive hair restoration\n- Strengthening of hair follicles\n- Increased hair density\n- Improved scalp condition\n- Fast and visible results\n\n**What results can you expect?**\n- Thicker and stronger hair\n- Reduced breakage and hair loss\n- Improved hair growth\n- Healthy-looking scalp",
    to:
      "Hair fillers are an intensive treatment for restoring scalp and hair health, aimed at strengthening hair follicles, improving hair structure, and stimulating hair growth. Active ingredients help replenish nutrient deficiencies and enhance hair quality from within.",
  },
  {
    service: "brows",
    key: "treatment-01",
    // Note the non-breaking space ( ) after "procedure:**" — a copy-paste
    // artifact in the source data; must match exactly for the guard to work.
    from: "**Duration of the procedure:** 60-90 minutes",
    to:
      "VELVET lash lamination is a premium treatment that gives your lashes a natural curl, volume, and rich color while strengthening and restoring their structure. Using high-quality VELVET products, your lashes receive deep nourishment and protection, making them stronger and more resistant to external factors.",
  },
];

const MISSING_ENGLISH_PACKAGE = {
  service: "packages",
  key: "endospheres-face-care-6",
  name: "Package of 6 sessions (60 minutes each)",
  group: "Endospheres + Face Care Packages",
  durationLabel: "60 min",
  priceLabel: "€450",
  summary:
    "The perfect duo for maximum lifting effect and complete skin care.\n\n**Endospheres + Face Care Package**",
  description:
    "The perfect duo for maximum lifting effect and complete skin care.\n\n**Endospheres + Face Care Package**\n\n**What's included in one session:**\n\n- **Endospheres facial therapy** — lifting, improved skin tone, and reduction of puffiness.\n- **Facial care** — cleansing, an individually selected mask, massage, and finishing care with active ingredients.\n\n**Package options:**\n**Package of 6 sessions:**\n\n- Suitable as a starter course to see results and improve the skin's condition.\n- Recommended ahead of important events, or simply to refresh the skin.\n- Package price: €450",
};

async function main() {
  const summaryResults: Record<string, boolean> = {};

  for (const fix of SUMMARY_FIXES) {
    const option = await prisma.serviceOption.findFirst({
      where: { key: fix.key, service: { slug: fix.service } },
    });
    if (!option) throw new Error(`${fix.service}/${fix.key} not found`);

    const content = await prisma.serviceOptionContent.findUnique({
      where: { optionId_locale: { optionId: option.id, locale: "en" } },
    });
    if (!content) throw new Error(`${fix.service}/${fix.key}/en content not found`);

    const changed = content.summary === fix.from;
    if (changed) {
      await prisma.serviceOptionContent.update({ where: { id: content.id }, data: { summary: fix.to } });
    } else if (content.summary !== fix.to) {
      throw new Error(`${fix.service}/${fix.key}: summary matched neither old nor new value — check manually.`);
    }
    summaryResults[`${fix.service}/${fix.key}`] = changed;
  }

  const service = await prisma.service.findUnique({ where: { slug: MISSING_ENGLISH_PACKAGE.service } });
  if (!service) throw new Error(`${MISSING_ENGLISH_PACKAGE.service} service not found`);
  const option = await prisma.serviceOption.findUnique({
    where: { serviceId_key: { serviceId: service.id, key: MISSING_ENGLISH_PACKAGE.key } },
  });
  if (!option) throw new Error(`${MISSING_ENGLISH_PACKAGE.service}/${MISSING_ENGLISH_PACKAGE.key} not found`);

  const existingEn = await prisma.serviceOptionContent.findUnique({
    where: { optionId_locale: { optionId: option.id, locale: "en" } },
  });
  let packageCreated = false;
  if (!existingEn) {
    await prisma.serviceOptionContent.create({
      data: {
        optionId: option.id,
        locale: "en",
        name: MISSING_ENGLISH_PACKAGE.name,
        group: MISSING_ENGLISH_PACKAGE.group,
        durationLabel: MISSING_ENGLISH_PACKAGE.durationLabel,
        priceLabel: MISSING_ENGLISH_PACKAGE.priceLabel,
        summary: MISSING_ENGLISH_PACKAGE.summary,
        description: MISSING_ENGLISH_PACKAGE.description,
        status: "PUBLISHED",
      },
    });
    packageCreated = true;
  }

  console.log(JSON.stringify({ summaryResults, packageCreated }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
