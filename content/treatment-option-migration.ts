import {
  ENDOSPHERES_DURATION_SUMMARIES,
  ENDOSPHERES_OFFER_SUMMARY,
  ENDOSPHERES_PACKAGES,
  ENDOSPHERES_PACKAGE_NOTE,
  ENDOSPHERES_SERVICES,
} from "./endospheres";

export const TREATMENT_MIGRATION_SOURCES = {
  generated: "scraped_content via content/generated/pages.json (2026-08-01)",
  endospheres: "Endospheres July 2026 clinic-approved PDFs",
  authored: "content/authored-pages.ts ([CLINIC TO PROVIDE] guarded pages)",
} as const;

export const SERVICE_MIGRATION_PAGES: Record<string, string> = {
  facial: "services/face",
  body: "services/body",
  laser: "services/laser",
  rf: "services/mikroneulanrf",
  trichology: "services/tricho",
  brows: "services/eyebrows",
  packages: "services/packages",
  endospheres: "instrumental/endosphere",
};

export const STANDALONE_APPOINTMENT_OPTION_SEED = [
  {
    serviceSlug: "consultation",
    key: "consultation-30",
    bookingDurationMin: 30,
    groups: {
      en: "Appointments",
      fi: "Vastaanotot",
      ru: "Приёмы",
    },
    durationLabels: {
      en: "30 min",
      fi: "30 min",
      ru: "30 мин",
    },
  },
  {
    serviceSlug: "injectable",
    key: "injectable-45",
    bookingDurationMin: 45,
    groups: {
      en: "Appointments",
      fi: "Vastaanotot",
      ru: "Приёмы",
    },
    durationLabels: {
      en: "45 min",
      fi: "45 min",
      ru: "45 мин",
    },
  },
] as const;

type PackageLocaleSeed = {
  group: string;
  name: string;
  durationLabel: string;
  priceLabel: string;
};

type PackageSeed = {
  key: string;
  displayOrder: number;
  bookingDurationMin: number;
  bookingServiceSlug: string | null;
  labels: Partial<Record<"en" | "fi" | "ru", PackageLocaleSeed>>;
  source: string;
};

const packageSource = `${TREATMENT_MIGRATION_SOURCES.generated}: services/packages`;
const duration = (minutes: number, locale: "en" | "fi" | "ru") =>
  locale === "ru" ? `${minutes} мин` : `${minutes} min`;
const label = (
  group: string,
  name: string,
  minutes: number,
  priceLabel: string,
  locale: "en" | "fi" | "ru",
): PackageLocaleSeed => ({
  group,
  name,
  durationLabel: duration(minutes, locale),
  priceLabel,
});

/**
 * Canonical course identity for the Packages service. Labels and prices are transcribed from
 * scraped_content/{locale}/services-packages.md; absent locales intentionally have no content.
 * A booking reserves the first visit only, using the server-owned duration below.
 */
export const PACKAGES_OPTION_SEED: readonly PackageSeed[] = [
  {
    key: "reset-course",
    displayOrder: 0,
    bookingDurationMin: 90,
    bookingServiceSlug: null,
    labels: {
      en: label("“Reset” Package", "Reset", 90, "1390 €", "en"),
      fi: label(
        "“Uudistuminen” – hoitopaketti",
        "Uudistuminen",
        90,
        "1390 €",
        "fi",
      ),
      ru: label(
        'Пакет процедур "Перезагрузка"',
        "Перезагрузка",
        90,
        "1390 €",
        "ru",
      ),
    },
    source: packageSource,
  },
  ...([30, 45, 60, 75] as const).flatMap((minutes, durationIndex) =>
    ([6, 12] as const).map((sessions, sessionIndex): PackageSeed => {
      const prices = {
        30: {
          6: { en: 350, fi: 350, ru: 350 },
          12: { en: 650, fi: 650, ru: 650 },
        },
        45: {
          6: { en: 450, fi: 450, ru: 450 },
          12: { en: 850, fi: 850, ru: 850 },
        },
        60: {
          6: { en: 570, fi: 570, ru: 570 },
          12: { en: 1050, fi: 1050, ru: 1050 },
        },
        75: {
          6: { en: 650, fi: 650, ru: 650 },
          12: { en: 1250, fi: 1250, ru: 1250 },
        },
      } as const;
      return {
        key: `endospheres-${minutes}-${sessions}`,
        displayOrder: 10 + durationIndex * 2 + sessionIndex,
        bookingDurationMin: minutes,
        bookingServiceSlug: `endospheres-${minutes}`,
        labels: {
          en: label(
            "Endospheres Therapy Packages",
            `Package of ${sessions} sessions (${minutes} minutes each)`,
            minutes,
            `€${prices[minutes][sessions].en}`,
            "en",
          ),
          fi: label(
            "Endospheres Therapy hoitopaketit",
            `${minutes} minuutin hoitopaketit ${sessions} kerta`,
            minutes,
            `${prices[minutes][sessions].fi} €`,
            "fi",
          ),
          ru: label(
            "Пакеты процедур Endospheres Therapy",
            `Пакет из ${sessions} процедур по ${minutes} минут`,
            minutes,
            `${prices[minutes][sessions].ru} €`,
            "ru",
          ),
        },
        source: packageSource,
      };
    }),
  ),
  {
    key: "arosha-wrap-6",
    displayOrder: 20,
    bookingDurationMin: 60,
    bookingServiceSlug: "body",
    labels: {
      en: label(
        "AROSHA Body Wrap Packages",
        "Package of 6 sessions",
        60,
        "€350",
        "en",
      ),
      fi: label(
        "AROSHA-vartalokäärehoitopaketti",
        "AROSHA-vartalokäärehoitopaketti 6 kerta",
        60,
        "350 €",
        "fi",
      ),
      ru: label(
        "Пакет обертываний от AROSHA",
        "Пакет обертываний на 6 процедур",
        60,
        "370 €",
        "ru",
      ),
    },
    source: packageSource,
  },
  {
    key: "arosha-wrap-12",
    displayOrder: 21,
    bookingDurationMin: 60,
    bookingServiceSlug: "body",
    labels: {
      en: label(
        "AROSHA Body Wrap Packages",
        "Package of 12 sessions",
        60,
        "€650",
        "en",
      ),
      fi: label(
        "AROSHA-vartalokäärehoitopaketti",
        "AROSHA-vartalokäärehoitopaketti 12 kerta",
        60,
        "650 €",
        "fi",
      ),
      ru: label(
        "Пакет обертываний от AROSHA",
        "Пакет обертываний на 12 процедур",
        60,
        "720 €",
        "ru",
      ),
    },
    source: packageSource,
  },
  {
    key: "fractional-mesotherapy-5",
    displayOrder: 31,
    bookingDurationMin: 60,
    bookingServiceSlug: "facial",
    labels: {
      en: label(
        "Microneedling Treatment Package — 5 Sessions",
        "Fractional Mesotherapy",
        60,
        "500 €",
        "en",
      ),
      fi: label(
        "Mikroneulaus-hoitopaketti — 5 kertaa",
        "Fraktionaalinen mesoterapia",
        60,
        "500 €",
        "fi",
      ),
      ru: label(
        "Пакет процедур Микронидлинг — 5 сеансов",
        "Фракционная мезотерапия",
        60,
        "500 €",
        "ru",
      ),
    },
    source: packageSource,
  },
  {
    key: "endospheres-face-care-6",
    displayOrder: 30,
    bookingDurationMin: 60,
    bookingServiceSlug: "endospheres-60",
    labels: {
      fi: label(
        "Endospheres-hoito kasvoille",
        "60 minuutin hoitopaketit 6 kerta",
        60,
        "450 €",
        "fi",
      ),
      ru: label(
        "Пакет процедур для лица",
        "Эндосфера и уход для лица 6 процедур",
        60,
        "450 €",
        "ru",
      ),
    },
    source: packageSource,
  },
  ...(
    [
      [
        "upper-lip-chin",
        {
          en: "Upper Lip + Chin",
          fi: "Ylähuuli + Leuka",
          ru: "Верхняя губа + Подбородок",
        },
      ],
      [
        "underarms-bikini-line",
        {
          en: "Underarms + Bikini Line",
          fi: "Kainalot + Bikinilinja",
          ru: "Подмышки + Линия бикини",
        },
      ],
      [
        "underarms-brazilian",
        {
          en: "Underarms + Brazilian Bikini",
          fi: "Kainalot + Brasilialainen bikini",
          ru: "Подмышки + Бразильское бикини",
        },
      ],
      [
        "brazilian-full-legs",
        {
          en: "Brazilian Bikini + Full Legs",
          fi: "Brasilialainen bikini + Jalat kokonaan",
          ru: "Бразильское бикини + Ноги целиком",
        },
      ],
      [
        "underarms-brazilian-full-legs",
        {
          en: "Underarms + Brazilian Bikini + Full Legs",
          fi: "Kainalot + Brasilialainen bikini + Jalat kokonaan",
          ru: "Подмышки + Бразильское бикини + Ноги целиком",
        },
      ],
      ["full-body", { en: "Full Body", fi: "Koko keho", ru: "Всё тело" }],
    ] as const
  ).flatMap(([areaKey, names], areaIndex) =>
    ([5, 10] as const).map((sessions, sessionIndex): PackageSeed => {
      const priceRows = [
        [202, 360],
        [315, 560],
        [652, 1160],
        [1305, 2320],
        [1417, 2520],
        [4500, 8000],
      ];
      const price = priceRows[areaIndex][sessionIndex];
      return {
        key: `laser-${areaKey}-${sessions}`,
        displayOrder: 40 + areaIndex * 2 + sessionIndex,
        bookingDurationMin: 60,
        bookingServiceSlug: "laser",
        labels: {
          en: label(
            "Laser hair removal package",
            `${names.en} ${sessions} sessions`,
            60,
            `${price} €`,
            "en",
          ),
          fi: label(
            "Laserkarvanpoistopaketti",
            `${names.fi} ${sessions} kertaa`,
            60,
            `${price} €`,
            "fi",
          ),
          ru: label(
            "Пакет процедур лазерная эпиляция",
            `${names.ru} ${sessions} сеансов`,
            60,
            `${price} €`,
            "ru",
          ),
        },
        source: packageSource,
      };
    }),
  ),
] as const;

const PACKAGE_LEGACY_KEYS: Record<"en" | "fi" | "ru", readonly string[]> = {
  fi: [
    "reset-course",
    "arosha-wrap-6",
    "arosha-wrap-12",
    "fractional-mesotherapy-5",
    "laser-upper-lip-chin-5",
    "laser-upper-lip-chin-10",
    "laser-underarms-bikini-line-5",
    "laser-underarms-bikini-line-10",
    "laser-underarms-brazilian-5",
    "laser-underarms-brazilian-10",
    "laser-brazilian-full-legs-5",
    "laser-brazilian-full-legs-10",
    "laser-underarms-brazilian-full-legs-5",
    "laser-underarms-brazilian-full-legs-10",
    "laser-full-body-5",
    "laser-full-body-10",
  ],
  en: [
    "reset-course",
    "endospheres-30-6",
    "endospheres-45-6",
    "endospheres-60-6",
    "endospheres-75-6",
    "arosha-wrap-6",
    "fractional-mesotherapy-5",
    "laser-upper-lip-chin-5",
    "laser-upper-lip-chin-10",
    "laser-underarms-bikini-line-5",
    "laser-underarms-bikini-line-10",
    "laser-underarms-brazilian-5",
    "laser-underarms-brazilian-10",
    "laser-brazilian-full-legs-5",
    "laser-brazilian-full-legs-10",
    "laser-underarms-brazilian-full-legs-5",
    "laser-underarms-brazilian-full-legs-10",
    "laser-full-body-5",
    "laser-full-body-10",
  ],
  ru: [
    "reset-course",
    "endospheres-30-6",
    "endospheres-30-12",
    "endospheres-45-6",
    "endospheres-45-12",
    "endospheres-60-6",
    "endospheres-60-12",
    "endospheres-75-6",
    "endospheres-75-12",
    "arosha-wrap-6",
    "arosha-wrap-12",
    "endospheres-face-care-6",
    "fractional-mesotherapy-5",
    "laser-upper-lip-chin-5",
    "laser-upper-lip-chin-10",
    "laser-underarms-bikini-line-5",
    "laser-underarms-bikini-line-10",
    "laser-underarms-brazilian-5",
    "laser-underarms-brazilian-10",
    "laser-brazilian-full-legs-5",
    "laser-brazilian-full-legs-10",
    "laser-underarms-brazilian-full-legs-5",
    "laser-underarms-brazilian-full-legs-10",
    "laser-full-body-5",
    "laser-full-body-10",
  ],
};

export function packagesLegacyOptionKey(
  locale: "en" | "fi" | "ru",
  oneBasedIndex: number,
) {
  return PACKAGE_LEGACY_KEYS[locale][oneBasedIndex - 1] ?? null;
}

export const ENDOSPHERES_OPTION_SEED = [
  ...ENDOSPHERES_SERVICES.map((item, index) => ({
    key: item.key.replace(/^endospheres-/, ""),
    displayOrder: index,
    bookingDurationMin: item.durationMin,
    type: "APPOINTMENT" as const,
    bookable: true,
    offerRequiresAccount: item.offer,
    labels: {
      en: {
        name: item.labels.en,
        durationLabel: `${item.durationMin} min`,
        priceLabel: `€${item.price}`,
        // The introductory offer describes what it includes; the standard
        // durations use the PDF's treatment-duration guide.
        summary: item.offer
          ? ENDOSPHERES_OFFER_SUMMARY.en
          : ENDOSPHERES_DURATION_SUMMARIES[item.durationMin].en,
      },
      fi: {
        name: item.labels.fi,
        durationLabel: `${item.durationMin} min`,
        priceLabel: `${item.price} €`,
        summary: item.offer
          ? ENDOSPHERES_OFFER_SUMMARY.fi
          : ENDOSPHERES_DURATION_SUMMARIES[item.durationMin].fi,
      },
      ru: {
        name: item.labels.ru,
        durationLabel: `${item.durationMin} мин`,
        priceLabel: `${item.price} €`,
        summary: item.offer
          ? ENDOSPHERES_OFFER_SUMMARY.ru
          : ENDOSPHERES_DURATION_SUMMARIES[item.durationMin].ru,
      },
    },
    source: TREATMENT_MIGRATION_SOURCES.endospheres,
  })),
  ...ENDOSPHERES_PACKAGES.flatMap((item, row) =>
    [
      { sessions: 6, price: item.six, order: row * 2 },
      { sessions: 12, price: item.twelve, order: row * 2 + 1 },
    ].map((pack) => ({
      key: `package-${item.durationMin}-${pack.sessions}`,
      displayOrder: 100 + pack.order,
      bookingDurationMin: item.durationMin,
      bookingServiceSlug: `endospheres-${item.durationMin}`,
      type: "COURSE" as const,
      bookable: true,
      offerRequiresAccount: false,
      labels: {
        en: {
          name: `${pack.sessions} × ${item.durationMin} min`,
          durationLabel: null,
          priceLabel: `€${pack.price}`,
          summary: `${ENDOSPHERES_DURATION_SUMMARIES[item.durationMin].en}\n\n${ENDOSPHERES_PACKAGE_NOTE.en}`,
        },
        fi: {
          name: `${pack.sessions} × ${item.durationMin} min`,
          durationLabel: null,
          priceLabel: `${pack.price} €`,
          summary: `${ENDOSPHERES_DURATION_SUMMARIES[item.durationMin].fi}\n\n${ENDOSPHERES_PACKAGE_NOTE.fi}`,
        },
        ru: {
          name: `${pack.sessions} × ${item.durationMin} мин`,
          durationLabel: null,
          priceLabel: `${pack.price} €`,
          summary: `${ENDOSPHERES_DURATION_SUMMARIES[item.durationMin].ru}\n\n${ENDOSPHERES_PACKAGE_NOTE.ru}`,
        },
      },
      source: TREATMENT_MIGRATION_SOURCES.endospheres,
    })),
  ),
] as const;

/** Published ranges reserve their maximum; a missing reliable duration stays informational. */
export function maximumPublishedDuration(label: string): number | null {
  const matches = [
    ...label.matchAll(
      /(\d{1,3})(?:\s*(?:–|-|—)\s*(\d{1,3}))?\s*(?:min(?:ute)?s?|мин(?:ут[ы]?)?)/giu,
    ),
  ];
  if (!matches.length) return null;
  return Math.max(
    ...matches.flatMap((match) => [
      Number(match[1]),
      Number(match[2] ?? match[1]),
    ]),
  );
}
