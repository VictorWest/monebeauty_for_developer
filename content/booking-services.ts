import type { Locale } from "@/i18n/routing";
import { getPageContent } from "@/content/pages";
import { ENDOSPHERES_SERVICES } from "@/content/endospheres";

/**
 * Bookable-services registry: the single source of truth for what can be booked.
 * Derived from the existing real service/content pages (SCOPE.md keeps the real service
 * set). `category` mirrors the Prisma `ServiceCategory` enum. SCOPE's aesthetic-medicine
 * additions that have no scraped copy yet are `bookable: false` ([CLINIC TO PROVIDE]).
 */

/** Mirrors the `ServiceCategory` enum in prisma/schema.prisma. */
export type ServiceCategory =
  "FACE" | "BODY" | "HAIR" | "INJECTABLE" | "DEVICE" | "LASER" | "CONSULTATION";

export interface BookingService {
  /** Stable key used in `?service=` and as the DB `Service.slug`. */
  key: string;
  /** Existing content-page slug (for `getPageContent` / deep-links), or null for stubs. */
  contentSlug: string | null;
  category: ServiceCategory;
  durationMin: number;
  image: string | null;
  /** false = [CLINIC TO PROVIDE] stub, not offered in the picker yet. */
  bookable: boolean;
}

// Image paths below were re-audited against client feedback that photos
// don't always match the selected service — this registry is a separate,
// hand-authored list (not read from the DB `Service` table), so it was
// invisible to every earlier CMS-driven photo replacement pass and still had
// several stale/wrong images: a flat-lay product photo reused for both
// Facial and Packages, a real archival clinic photo (old white coat, no navy
// uniform) misused for Consultation, and a body card that actually showed
// laser equipment. Repointed to the on-brand assets already verified
// elsewhere on the site.
export const BOOKING_SERVICES: BookingService[] = [
  {
    key: "facial",
    contentSlug: "services/face",
    category: "FACE",
    durationMin: 60,
    image: "/media/facial/facial-skincare-application.jpg",
    bookable: true,
  },
  {
    key: "body",
    contentSlug: "services/body",
    category: "BODY",
    durationMin: 60,
    image: "/media/home/body-card.jpg",
    bookable: true,
  },
  {
    key: "endospheres",
    contentSlug: "instrumental/endosphere",
    category: "DEVICE",
    durationMin: 45,
    image: "/media/home/endospheres-card.jpg",
    bookable: true,
  },
  {
    key: "laser",
    contentSlug: "services/laser",
    category: "LASER",
    durationMin: 30,
    image: "/media/home/laser-card.jpg",
    bookable: true,
  },
  {
    key: "rf",
    contentSlug: "services/mikroneulanrf",
    category: "DEVICE",
    durationMin: 60,
    image: "/media/rf/rf-hero-full-room.jpg",
    bookable: true,
  },
  {
    key: "trichology",
    contentSlug: "services/tricho",
    category: "HAIR",
    durationMin: 45,
    image: "/media/home/trichology-card.jpg",
    bookable: true,
  },
  {
    key: "brows",
    contentSlug: "services/eyebrows",
    category: "FACE",
    durationMin: 30,
    image: "/media/home/brows.jpg",
    bookable: true,
  },
  {
    key: "packages",
    contentSlug: "services/packages",
    category: "BODY",
    durationMin: 90,
    image: "/media/home/packages-hero.jpg",
    bookable: true,
  },
  // SCOPE.md aesthetic-medicine services. They have no scraped copy, so their pages are
  // hand-authored in `content/authored-pages.ts` and their clinical specifics stay
  // [CLINIC TO PROVIDE] until the clinic supplies them.
  {
    key: "injectable",
    contentSlug: "services/injectable",
    category: "INJECTABLE",
    durationMin: 45,
    image: "/media/stock/dermal-filler-pexels-34775441.jpg",
    bookable: true,
  },
  {
    key: "consultation",
    contentSlug: "services/consultation",
    category: "CONSULTATION",
    durationMin: 30,
    image: "/media/home/consultation-card.jpg",
    bookable: true,
  },
];

const BY_KEY = new Map(BOOKING_SERVICES.map((s) => [s.key, s]));

export function getBookingService(key: string): BookingService | undefined {
  return BY_KEY.get(key);
}

/** Services offered in the picker (excludes [CLINIC TO PROVIDE] stubs). */
export function bookableServices(): BookingService[] {
  return BOOKING_SERVICES.filter((s) => s.bookable);
}

/** Booking key for an existing service content-page slug (for "Book this treatment"). */
export function bookingKeyForContentSlug(
  contentSlug: string,
): string | undefined {
  return BOOKING_SERVICES.find(
    (s) =>
      (s.contentSlug === contentSlug || s.key === contentSlug) && s.bookable,
  )?.key;
}

/** Human title for a service key: prefers the real content-page title. */
export function bookingServiceTitle(
  key: string,
  locale: Locale,
): string | null {
  const endospheres = ENDOSPHERES_SERVICES.find((item) => item.key === key);
  if (endospheres) return endospheres.labels[locale];
  const s = BY_KEY.get(key);
  if (!s?.contentSlug) return null;
  return getPageContent(s.contentSlug, locale)?.title ?? null;
}
