import "server-only";

import { prisma } from "@/lib/db";
import { SITE_MEDIA_BY_KEY } from "@/content/site-media";
import type { Locale } from "@/i18n/routing";
import { localizedMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export type PublicManagedImage = {
  image: string | null;
  alt: string;
  focalX: number;
  focalY: number;
  decorative: boolean;
};

export function focalPosition(
  image: Pick<PublicManagedImage, "focalX" | "focalY">,
) {
  return `${image.focalX}% ${image.focalY}%`;
}

export async function getSiteMedia(
  key: string,
  locale: Locale,
): Promise<PublicManagedImage> {
  const [saved, definition] = await Promise.all([
    prisma.siteMediaSlot.findUnique({
      where: { key },
      include: { contents: { where: { locale }, take: 1 } },
    }),
    Promise.resolve(SITE_MEDIA_BY_KEY.get(key)),
  ]);
  const decorative = saved?.decorative ?? definition?.decorative ?? false;
  return {
    image: saved?.image ?? definition?.fallback ?? null,
    alt: decorative
      ? ""
      : (saved?.contents[0]?.alt ?? definition?.alt[locale] ?? ""),
    focalX: saved?.focalX ?? 50,
    focalY: saved?.focalY ?? 50,
    decorative,
  };
}

export async function getSiteMediaMap(keys: string[], locale: Locale) {
  const entries = await Promise.all(
    keys.map(async (key) => [key, await getSiteMedia(key, locale)] as const),
  );
  return Object.fromEntries(entries) as Record<string, PublicManagedImage>;
}

type LocalizedMetadataInput = Parameters<typeof localizedMetadata>[0];

/** Uses the admin-managed site social image whenever an entity has no own image. */
export async function managedLocalizedMetadata(
  input: LocalizedMetadataInput,
): Promise<Metadata> {
  if (input.image) return localizedMetadata(input);
  const social = await getSiteMedia("site.default-social", input.locale);
  return localizedMetadata({
    ...input,
    image: social.image,
    imageAlt: input.imageAlt || social.alt,
  });
}
