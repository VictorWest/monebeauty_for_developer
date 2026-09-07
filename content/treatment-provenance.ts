/**
 * Provenance for the generated treatment registry.
 *
 * This replaces the former `treatment-enrichment.ts`, which appended seven
 * templated sections ("This is the specific treatment option described in the
 * source introduction above…") to every localized record. The clinic read that
 * filler as copy that was not theirs, so it is gone: a treatment description is
 * now exactly what the source published, and nothing else.
 *
 * With the generic sections removed, the public-health references they cited
 * (NHS, FDA, AAD) are no longer quoted anywhere and are not listed as sources.
 * Every published word now traces to one of the three sources below.
 */
export const TREATMENT_SOURCE_VERSION = "2026-08-07-v2";

/** Options whose copy comes from `content/authored-pages.ts`, not the old site. */
export const AUTHORED_TREATMENT_SERVICES = new Set([
  "consultation",
  "injectable",
]);

/** Options whose copy comes from the clinic's Endospheres PDFs. */
export const CLINIC_PDF_TREATMENT_SERVICES = new Set(["endospheres"]);

/**
 * Source ids backing a treatment, ordered most authoritative last. Keys must
 * exist in `content/treatment-provenance.json`, which the generator validates.
 */
export function treatmentSourceIds(service: string): string[] {
  if (AUTHORED_TREATMENT_SERVICES.has(service))
    return ["mone-authored-appointments"];
  if (CLINIC_PDF_TREATMENT_SERVICES.has(service))
    return ["mone-live-copy", "endospheres-clinic-pdfs"];
  return ["mone-live-copy"];
}
