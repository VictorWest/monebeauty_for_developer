import type { MetadataRoute } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { absoluteAssetUrl, absoluteLocalizedUrl, siteUrl } from "@/lib/seo";

export type SitemapEntry = {
  path: string;
  locale: Locale;
  updatedAt?: Date;
  image?: string | null;
};

export function renderSitemap(entries: SitemapEntry[]): MetadataRoute.Sitemap {
  const unique = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    const key = `${entry.locale}:${entry.path}`;
    const current = unique.get(key);
    unique.set(key, {
      ...current,
      ...entry,
      image: entry.image || current?.image,
      updatedAt:
        current?.updatedAt && entry.updatedAt
          ? current.updatedAt > entry.updatedAt
            ? current.updatedAt
            : entry.updatedAt
          : entry.updatedAt || current?.updatedAt,
    });
  }
  const all = [...unique.values()].sort(
    (a, b) =>
      routing.locales.indexOf(a.locale) - routing.locales.indexOf(b.locale) ||
      a.path.localeCompare(b.path),
  );
  const site = siteUrl();
  return all.map((entry) => {
    const available = all
      .filter((candidate) => candidate.path === entry.path)
      .map((candidate) => candidate.locale);
    return {
      url: absoluteLocalizedUrl(site, entry.path, entry.locale),
      ...(entry.updatedAt ? { lastModified: entry.updatedAt } : {}),
      ...(entry.image ? { images: [absoluteAssetUrl(entry.image)] } : {}),
      alternates: {
        languages: Object.fromEntries([
          ...available.map((locale) => [
            locale,
            absoluteLocalizedUrl(site, entry.path, locale),
          ]),
          ...(available.includes("fi")
            ? [["x-default", absoluteLocalizedUrl(site, entry.path, "fi")]]
            : []),
        ]),
      },
    };
  });
}
