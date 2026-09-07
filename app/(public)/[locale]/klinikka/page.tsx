import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ContentPage } from "@/components/ContentPage";
import {
  getIndexablePageLocales,
  getLivePageContent,
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
    getLivePageContent("about", locale as Locale),
    getIndexablePageLocales("about"),
  ]);
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.clinic,
    title: c?.seoTitle || c?.title,
    description: c?.seoDescription || (c ? excerpt(c.body) : undefined),
    image: c?.hero,
    imageAlt: c?.imageAlt || c?.title,
    indexable: c?.seoIndexable ?? false,
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
  return <ContentPage slug="about" locale={locale as Locale} />;
}
