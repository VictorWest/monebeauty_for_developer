import pagesData from "./generated/pages.json";
import { parseProcedures } from "../lib/procedures";
import type { Locale } from "../i18n/routing";

export type ProcedureIdentity = { group: string | null; title: string };
export type ProcedureMediaSeed = {
  serviceSlug: string;
  key: string;
  image: string;
  identities: Record<Locale, ProcedureIdentity[]>;
  sourceUrl: string;
  sourceLicense: "CLIENT_SUPPLIED" | "CLINIC_ARCHIVE" | "PEXELS" | "UNSPLASH";
};

const locales: Locale[] = ["en", "fi", "ru"];
const pages = pagesData as Record<string, Record<Locale, { body: string }>>;

const FACIAL = [
  "/media/home/facial.jpg",
  "/media/files/land/104/8c6f2e75d8051e304bca2fd6f22fa512.jpg",
  "/media/files/land/280/f28e71464377d786f853ef1371325d41.jpeg",
  "/media/files/land/280/e1bfe4cdb11c81de4fe6da49e8914239.jpg",
  "/media/files/land/280/4786a56a1b037c521fe8acebe5c90a9c.jpeg",
  "/media/files/land/268/297aa1aad5ec0dffb2a6e1aad8ff6d76.png",
  "/media/files/land/269/5fff420121b8db8b7166214be425daaf.jpg",
  "/media/files/land/269/3acb25418d922bc1b1eee4dd26542688.png",
  "/media/files/land/269/6d97dc012bbbb4c7d5ad782a489e01a7.png",
  "/media/files/land/272/74d5c3bd2fb154f6ccb44ce32de50b1a.jpeg",
  "/media/files/land/278/494b71d060df36d33e773d9ea8692edb.jpg",
  "/media/files/land/278/a7ef57737ab8ef2eb7113b70c07c8152.jpeg",
  "/media/files/land/278/a922320ee5958be2e94a1a5ee8f71862.jpeg",
  "/media/files/land/278/cad351ad6a4dfa7093c6f71182ab976b.jpeg",
  "/media/files/land/281/07375b06ad19fde09214e59f96da53ce.jpeg",
] as const;

const BODY = [
  "/media/stock/endospheres-body-pexels-7772683.jpg",
  "/media/files/land/104/760bda4adade7e51ab613436640590b3.jpg",
  "/media/files/land/100/0397dd6e1352c756a1a0ca523f7d12a6.jpg",
  "/media/files/land/99/0b0d7a710b2bf2b774dce0dee98eca13.jpg",
  "/media/files/land/99/632cfb5b6ffa46a890fc91a327f79a3f.jpg",
  "/media/home/arosha.jpg",
  "/media/files/land/133/aee24846322a462b149cee1d4c9fbdb9.jpg",
] as const;

const TRICHOLOGY = [
  "/media/files/land/301/a214b208578ca13b2e31ba04ca3074f1.jpg",
  "/media/files/land/303/5e7135aaffc757abe7dd5f3cb263e823.jpg",
  "/media/files/land/303/8b2e9288e47ba7705d700a8d7edb596e.jpeg",
  "/media/files/land/303/fb364d611074112e8e9cdf3880b1369f.jpg",
  "/media/files/land/306/2d55939f6cbc01f974408a78fe8485f4.jpg",
] as const;

const LASER = [
  "/media/clinic/laser/laser-face-hair-removal.jpeg",
  "/media/clinic/laser/laser-chin-hair-removal.jpeg",
  "/media/clinic/laser/laser-neck-hair-removal.jpeg",
  "/media/clinic/laser/laser-forearm-hair-removal.jpeg",
  "/media/clinic/laser/laser-full-arm-hair-removal.jpeg",
  "/media/clinic/laser/laser-upper-arm-hair-removal.jpeg",
  "/media/clinic/laser/laser-underarm-hair-removal.jpeg",
  "/media/clinic/laser/laser-upper-body-hair-removal.jpeg",
  "/media/clinic/laser/laser-bikini-hair-removal.jpeg",
  "/media/clinic/laser/laser-full-leg-hair-removal.jpeg",
  "/media/clinic/laser/laser-lower-leg-hair-removal.jpeg",
  "/media/clinic/laser/laser-lower-body-hair-removal.jpeg",
  "/media/clinic/laser/laser-thigh-closeup-hair-removal.jpeg",
  "/media/clinic/laser/laser-thigh-hair-removal.jpeg",
] as const;

const RF = [
  "/media/files/land/262/5d61f11990b4a8762bc0d270efe8e48d.png",
  "/media/files/land/263/9efb6f47a46f739920f5050cf22bbd16.png",
  "/media/files/land/263/df41a2f948fe079be46a4c88c0652c86.jpg",
  "/media/files/land/263/e8e6c3d46507d3e5e5cc4448751d0a67.png",
  "/media/files/land/273/7b9c1275a755f75de6a3ef9a2cec799f.png",
  "/media/files/land/274/01e878311fd319f9a558217f85695089.png",
] as const;

const BROWS = [
  "/media/home/brows.jpg",
  "/media/stock/eyebrow-shaping-pexels-29588096.jpg",
  "/media/stock/eyebrow-tint-pexels-15046690.jpg",
  "/media/stock/eyelash-extension-pexels-29391092.jpg",
] as const;

const STOCK_PROVENANCE: Record<
  string,
  { sourceUrl: string; sourceLicense: "PEXELS" }
> = {
  "/media/stock/endospheres-body-pexels-7772683.jpg": {
    sourceUrl:
      "https://www.pexels.com/photo/faceless-woman-receiving-weight-loss-procedure-on-table-7772683/",
    sourceLicense: "PEXELS",
  },
  "/media/stock/eyebrow-shaping-pexels-29588096.jpg": {
    sourceUrl:
      "https://www.pexels.com/photo/professional-eyebrow-shaping-at-beauty-salon-29588096/",
    sourceLicense: "PEXELS",
  },
  "/media/stock/eyebrow-tint-pexels-15046690.jpg": {
    sourceUrl:
      "https://www.pexels.com/photo/a-person-applying-makeup-to-a-woman-15046690/",
    sourceLicense: "PEXELS",
  },
  "/media/stock/eyelash-extension-pexels-29391092.jpg": {
    sourceUrl:
      "https://www.pexels.com/photo/professional-eyelash-extension-application-in-salon-29391092/",
    sourceLicense: "PEXELS",
  },
};

const definitions: Array<{
  serviceSlug: string;
  page: string;
  images: readonly string[];
  assignments: number[] | Record<Locale, number[]>;
}> = [
  {
    serviceSlug: "facial",
    page: "services/face",
    images: FACIAL,
    assignments: [
      0, 1, 2, 3, 4, 5, 4, 6, 7, 8, 9, 10, 11, 12, 11, 12, 11, 12, 11, 12, 13,
      14,
    ],
  },
  {
    serviceSlug: "body",
    page: "services/body",
    images: BODY,
    assignments: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    serviceSlug: "trichology",
    page: "services/tricho",
    images: TRICHOLOGY,
    assignments: [0, 1, 2, 3, 4],
  },
  {
    serviceSlug: "laser",
    page: "services/laser",
    images: LASER,
    assignments: [
      0, 1, 0, 2, 0, 1, 0, 2, 7, 2, 7, 6, 7, 6, 7, 6, 5, 3, 4, 6, 7, 11, 7, 11,
      8, 12, 8, 11, 13, 10, 9, 6, 8, 11, 9, 11,
    ],
  },
  {
    serviceSlug: "rf",
    page: "services/mikroneulanrf",
    images: RF,
    assignments: [0, 1, 2, 0, 1, 2, 3, 4, 5, 3, 4, 5, 0, 1, 4],
  },
  {
    serviceSlug: "brows",
    page: "services/eyebrows",
    images: BROWS,
    assignments: [0, 1, 2, 3, 0, 1],
  },
  {
    serviceSlug: "packages",
    page: "services/packages",
    images: [...BODY, FACIAL[6], ...LASER],
    assignments: {
      en: [0, 1, 2, 3, 4, 5, 7, 8, 9, 14, 16, 14, 16, 19, 17, 19, 17, 13, 19],
      // Finnish now parses all 25 packages and lines up card-for-card with
      // Russian, so the two share a mapping. Nine were previously lost: eight
      // whose titles ("30 minuutin hoitopaketit 6 kerta") were mistaken for
      // price lines, plus "Uudistuminen", which titles itself with `###`.
      fi: [
        0, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 7, 8, 9, 14, 16, 14, 16, 19, 17, 19,
        17, 13, 19,
      ],
      ru: [
        0, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 7, 8, 9, 14, 16, 14, 16, 19, 17, 19,
        17, 13, 19,
      ],
    },
  },
];

function sourceUrl(image: string) {
  if (STOCK_PROVENANCE[image]) return STOCK_PROVENANCE[image].sourceUrl;
  if (image.startsWith("/media/files/") || image.startsWith("/media/images/"))
    return `https://monebeauty.fi${image.replace(/^\/media/, "")}`;
  return "https://monebeauty.fi/";
}

function assignmentsFor(
  assignments: number[] | Record<Locale, number[]>,
  locale: Locale,
  targetLength: number,
) {
  if (!Array.isArray(assignments)) return assignments[locale];
  const resolved = [...assignments];
  while (resolved.length < targetLength)
    resolved.push(
      assignments[(resolved.length - assignments.length) % assignments.length],
    );
  return resolved.slice(0, targetLength);
}

export const PROCEDURE_MEDIA_SEED: ProcedureMediaSeed[] = definitions.flatMap(
  (definition) => {
    const localized = Object.fromEntries(
      locales.map((locale) => [
        locale,
        parseProcedures(pages[definition.page][locale].body),
      ]),
    ) as Record<Locale, ReturnType<typeof parseProcedures>>;
    if (
      Array.isArray(definition.assignments) &&
      definition.assignments.length !== localized.en.length
    )
      throw new Error(
        `Procedure media registry is out of sync for ${definition.serviceSlug}/en`,
      );
    for (const locale of locales)
      if (
        assignmentsFor(definition.assignments, locale, localized[locale].length)
          .length !== localized[locale].length
      )
        throw new Error(
          `Procedure media registry is out of sync for ${definition.serviceSlug}/${locale}`,
        );

    return definition.images
      .map((image, imageIndex) => {
        return {
          serviceSlug: definition.serviceSlug,
          key: `${definition.serviceSlug}-concept-${String(imageIndex + 1).padStart(2, "0")}`,
          image,
          identities: Object.fromEntries(
            locales.map((locale) => {
              const assignments = assignmentsFor(
                definition.assignments,
                locale,
                localized[locale].length,
              );
              return [
                locale,
                localized[locale]
                  .filter((_, index) => assignments[index] === imageIndex)
                  .map((item) => ({ group: item.group, title: item.title })),
              ];
            }),
          ) as Record<Locale, ProcedureIdentity[]>,
          sourceUrl: sourceUrl(image),
          sourceLicense:
            STOCK_PROVENANCE[image]?.sourceLicense ??
            (image.startsWith("/media/clinic/laser/")
              ? ("CLIENT_SUPPLIED" as const)
              : ("CLINIC_ARCHIVE" as const)),
        };
      })
      .filter((item) =>
        locales.some((locale) => item.identities[locale].length),
      );
  },
);

export function bootstrapProcedureMedia(serviceSlug: string) {
  return PROCEDURE_MEDIA_SEED.filter(
    (item) => item.serviceSlug === serviceSlug,
  );
}
