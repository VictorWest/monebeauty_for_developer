import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { TechnologyDetailPage } from "@/components/technology/TechnologyDetailPage";
import {
  getIndexableTechnologyLocales,
  getPublishedTechnologyByPath,
} from "@/lib/live-content";
import { excerpt } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [c, availableLocales] = await Promise.all([
    getPublishedTechnologyByPath(PUBLIC_PATHS.trichology, locale as Locale),
    getIndexableTechnologyLocales(PUBLIC_PATHS.trichology),
  ]);
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.trichology,
    title: c?.content.seoTitle || c?.content.name,
    description:
      c?.content.seoDescription ||
      (c ? excerpt(c.content.summary || c.content.body) : undefined),
    image: c?.images[0],
    imageAlt: c?.content.imageAlt || c?.content.name,
    indexable: c?.content.seoIndexable ?? false,
    availableLocales,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <TechnologyDetailPage
      path={PUBLIC_PATHS.trichology}
      locale={locale as Locale}
    />
  );
}
