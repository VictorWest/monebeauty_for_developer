import "server-only";

import type { ServiceGender, ServiceOptionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { excerpt } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { packagesLegacyOptionKey } from "@/content/treatment-option-migration";
import { normalizeEndospheresBookingOptions } from "@/lib/endospheres-booking-options";

export type BookingOptionSummary = {
  key: string;
  title: string;
  group: string | null;
  durationLabel: string | null;
  price: string;
  durationMin: number;
  offerRequiresAccount: boolean;
};

export type BookingServiceOption = {
  key: string;
  name: string;
  image: string | null;
  imageAlt: string;
  imageFocalX: number;
  imageFocalY: number;
  shortDescription: string;
  durationMin: number;
  priceFrom: number | null;
  priceMode: "FROM" | "FIXED";
  targetGender: ServiceGender;
  offerRequiresAccount: boolean;
  publicPath: string;
  // Lets the wizard offer a "+" multi-select cart across this service's
  // options (several procedures, one specialist, one visit) instead of
  // picking exactly one.
  multiProcedureBooking: boolean;
  options: BookingOptionSummary[];
};

/** Kept under the old exported name so operational consumers can migrate incrementally. */
export type BookingProcedureContext = BookingOptionSummary & {
  index?: number;
  description: string;
};

export type BookingContext = {
  service: BookingServiceOption;
  procedure: BookingProcedureContext | null;
};

const BOOKABLE_OPTION_TYPES: ServiceOptionType[] = ["APPOINTMENT", "COURSE"];

const optionInclude = (locale: Locale) => ({
  where: {
    archivedAt: null,
    published: true,
    type: { in: BOOKABLE_OPTION_TYPES },
    bookable: true,
  },
  orderBy: [{ displayOrder: "asc" as const }, { key: "asc" as const }],
  include: {
    contents: { where: { locale, status: "PUBLISHED" as const }, take: 1 },
  },
});

export async function getBookingServiceOptions(
  locale: Locale,
): Promise<BookingServiceOption[]> {
  const services = await prisma.service.findMany({
    where: {
      bookable: true,
      bookingPickerVisible: true,
      archivedAt: null,
      published: true,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
      options: optionInclude(locale),
    },
  });
  return services.flatMap((service) => {
    const content = service.contents[0];
    if (!content) return [];
    const options = localizedOptions(service.options, service.slug);
    return [
      {
        key: service.slug,
        name: content.h1,
        image: service.images[0] ?? null,
        imageAlt: content.imageAlt || content.h1,
        imageFocalX: service.imageFocalX,
        imageFocalY: service.imageFocalY,
        shortDescription: excerpt(content.shortDesc || content.whatItIs, 180),
        durationMin: service.durationMin,
        priceFrom:
          service.priceFrom === null ? null : Number(service.priceFrom),
        priceMode: service.priceMode,
        targetGender: service.targetGender,
        offerRequiresAccount: service.offerRequiresAccount,
        publicPath: service.publicPath || PUBLIC_PATHS.services,
        multiProcedureBooking: service.multiProcedureBooking,
        options,
      },
    ];
  });
}

/** Resolve only a published localized option. Legacy indices map through the persisted migration index. */
export async function getBookingContext(
  locale: Locale,
  serviceSlug: string | undefined,
  optionKey?: string,
  legacyProcedureIndex?: string | number,
): Promise<BookingContext | null> {
  if (!serviceSlug) return null;
  const service = await prisma.service.findFirst({
    where: {
      slug: serviceSlug,
      bookable: true,
      archivedAt: null,
      published: true,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
      options: optionInclude(locale),
    },
  });
  const content = service?.contents[0];
  if (!service || !content) return null;
  const options = localizedOptions(service.options, service.slug);
  const legacyIndex =
    typeof legacyProcedureIndex === "string" &&
    /^\d+$/.test(legacyProcedureIndex)
      ? Number(legacyProcedureIndex)
      : typeof legacyProcedureIndex === "number"
        ? legacyProcedureIndex
        : null;
  const legacyOptionKey =
    service.slug === "packages" && legacyIndex
      ? packagesLegacyOptionKey(locale, legacyIndex)
      : null;
  const selected = optionKey
    ? service.options.find((item) => item.key === optionKey)
    : legacyOptionKey
      ? service.options.find((item) => item.key === legacyOptionKey)
      : legacyIndex
        ? service.options.find(
            (item) =>
              item.legacyProcedureIndex === legacyIndex && item.contents[0],
          )
        : options.length === 1
          ? service.options[0]
          : undefined;
  const selectedContent = selected?.contents[0];
  const option =
    selected && selectedContent && selected.bookingDurationMin
      ? {
          key: selected.key,
          index: selected.legacyProcedureIndex ?? undefined,
          title: selectedContent.name,
          group: selectedContent.group,
          description: content.shortDesc,
          durationLabel: selectedContent.durationLabel,
          price: selectedContent.priceLabel ?? "",
          durationMin: selected.bookingDurationMin,
          offerRequiresAccount: selected.offerRequiresAccount,
        }
      : null;
  return {
    service: {
      key: service.slug,
      name: content.h1,
      image: service.images[0] ?? null,
      imageAlt: content.imageAlt || content.h1,
      imageFocalX: service.imageFocalX,
      imageFocalY: service.imageFocalY,
      shortDescription: excerpt(content.shortDesc || content.whatItIs, 180),
      durationMin: service.durationMin,
      priceFrom: service.priceFrom === null ? null : Number(service.priceFrom),
      priceMode: service.priceMode,
      targetGender: service.targetGender,
      offerRequiresAccount: service.offerRequiresAccount,
      publicPath: service.publicPath || PUBLIC_PATHS.services,
      multiProcedureBooking: service.multiProcedureBooking,
      options,
    },
    procedure: option,
  };
}

function localizedOptions(
  options: Array<{
    key: string;
    type: ServiceOptionType;
    bookingDurationMin: number | null;
    offerRequiresAccount: boolean;
    contents: Array<{
      group: string | null;
      name: string;
      durationLabel: string | null;
      priceLabel: string | null;
    }>;
  }>,
  serviceSlug: string,
): BookingOptionSummary[] {
  const localized = options.flatMap((option) => {
    const content = option.contents[0];
    return content && option.bookingDurationMin
      ? [
          {
            key: option.key,
            title: content.name,
            group: content.group,
            durationLabel: content.durationLabel,
            price: content.priceLabel ?? "",
            durationMin: option.bookingDurationMin,
            offerRequiresAccount: option.offerRequiresAccount,
          },
        ]
      : [];
  });
  if (serviceSlug !== "endospheres") return localized;

  const byKey = new Map(localized.map((option) => [option.key, option]));
  const normalized = normalizeEndospheresBookingOptions(
    options.flatMap((option) => {
      const content = option.contents[0];
      return content
        ? [
            {
              key: option.key,
              type: option.type,
              bookable: true,
              group: content.group,
              name: content.name,
              durationLabel: content.durationLabel,
              priceLabel: content.priceLabel,
              offerRequiresAccount: option.offerRequiresAccount,
            },
          ]
        : [];
    }),
  );
  return [
    ...normalized.singles,
    ...normalized.packages.flatMap(({ six, twelve }) => [six, twelve]),
  ]
    .flatMap((option) => (option ? [byKey.get(option.key)] : []))
    .filter((option): option is BookingOptionSummary => Boolean(option));
}
