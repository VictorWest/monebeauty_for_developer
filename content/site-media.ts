import type { Locale } from "@/i18n/routing";

export type SiteMediaDefinition = {
  key: string;
  label: Record<Locale, string>;
  fallback: string | null;
  required: boolean;
  decorative?: boolean;
  alt: Record<Locale, string>;
  aspect: "16:9" | "4:3" | "3:2";
};

export const SITE_MEDIA_DEFINITIONS: SiteMediaDefinition[] = [
  {
    key: "home.hero-poster",
    label: { fi: "Etusivun hero", en: "Homepage hero", ru: "Главный экран" },
    fallback: "/media/hero-poster.jpg",
    required: true,
    alt: {
      fi: "Mone Beauty Clinicin hoitotila",
      en: "Treatment room at Mone Beauty Clinic",
      ru: "Процедурный кабинет Mone Beauty Clinic",
    },
    aspect: "16:9",
  },
  ...(["face", "body", "hair", "men"] as const).map((area) => ({
    key: `home.area.${area}`,
    label: {
      fi: `Etusivun hoitoalue: ${area}`,
      en: `Homepage treatment area: ${area}`,
      ru: `Зона на главной странице: ${area}`,
    },
    fallback:
      area === "men"
        ? "/media/home/treatment-areas/men.png"
        : `/media/home/treatment-areas/${area}.jpeg`,
    required: true,
    decorative: true,
    alt: { fi: "", en: "", ru: "" },
    aspect: "4:3" as const,
  })),
  {
    key: "booking.hero",
    label: { fi: "Ajanvaraus", en: "Booking", ru: "Запись" },
    fallback: "/media/files/land/240/d0c2d035d8a3b00a7d39938b2a2b8bea.jpg",
    required: true,
    alt: {
      fi: "Varaa aika Mone Beauty Clinicille",
      en: "Book an appointment at Mone Beauty Clinic",
      ru: "Запись на приём в Mone Beauty Clinic",
    },
    aspect: "16:9",
  },
  ...([1, 2] as const).map((index) => ({
    key: `endospheres.editorial.${index}`,
    label: {
      fi: `Endospheres-artikkelikuva ${index}`,
      en: `Endospheres editorial image ${index}`,
      ru: `Изображение Endospheres ${index}`,
    },
    fallback:
      index === 1
        ? "/media/files/land/104/8c6f2e75d8051e304bca2fd6f22fa512.jpg"
        : "/media/files/land/99/e0e1d71833938c1a93b8b48246cfda7e.jpg",
    required: false,
    alt:
      index === 1
        ? {
            fi: "Endospheres-hoitokäsikappale käytössä",
            en: "Endospheres treatment handpiece in use",
            ru: "Манипула Endospheres во время процедуры",
          }
        : {
            fi: "Endospheres-käsikappaleen silikonipallot",
            en: "Endospheres silicone sphere handpiece",
            ru: "Силиконовые сферы манипулы Endospheres",
          },
    aspect: "4:3" as const,
  })),
  /**
   * Endospheres before-and-after pairs, requested by the clinic.
   *
   * No such photograph exists anywhere in the archive: the old site never
   * published one: so these have no fallback. `BeforeAfterGallery` hides a
   * pair until both of its images are set, and hides itself entirely until at
   * least one complete pair exists, so the page never shows an empty frame
   * while the clinic is still gathering the photos.
   */
  ...([1, 2, 3] as const).flatMap((pair) =>
    (["before", "after"] as const).map((phase) => ({
      key: `endospheres.beforeafter.${pair}.${phase}`,
      label: {
        fi: `Endospheres ennen/jälkeen ${pair}: ${phase === "before" ? "ennen" : "jälkeen"}`,
        en: `Endospheres before/after ${pair}: ${phase}`,
        ru: `Endospheres до/после ${pair}: ${phase === "before" ? "до" : "после"}`,
      },
      fallback: null,
      required: false,
      alt: {
        fi: `Endospheres-hoidon tulos ${pair}: ${phase === "before" ? "ennen hoitoa" : "hoitosarjan jälkeen"}`,
        en: `Endospheres treatment result ${pair}: ${phase === "before" ? "before treatment" : "after the treatment course"}`,
        ru: `Результат процедуры Endospheres ${pair}: ${phase === "before" ? "до процедуры" : "после курса процедур"}`,
      },
      aspect: "3:2" as const,
    })),
  ),
  {
    key: "site.default-social",
    label: {
      fi: "Sivuston oletusjakokuva",
      en: "Default social image",
      ru: "Изображение для соцсетей",
    },
    fallback: null,
    required: false,
    alt: {
      fi: "Mone Beauty Clinic",
      en: "Mone Beauty Clinic",
      ru: "Mone Beauty Clinic",
    },
    aspect: "16:9",
  },
];

export const SITE_MEDIA_BY_KEY = new Map(
  SITE_MEDIA_DEFINITIONS.map((definition) => [definition.key, definition]),
);
