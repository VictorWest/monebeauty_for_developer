import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { AroshaPage } from "@/components/arosha/AroshaPage";
import {
  getIndexablePageLocales,
  getLivePageContent,
} from "@/lib/live-content";
import { excerpt } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [c, availableLocales] = await Promise.all([
    getLivePageContent("arosha", locale as Locale),
    getIndexablePageLocales("arosha"),
  ]);
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: "/arosha",
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
  return <AroshaPage slug="arosha" locale={locale as Locale} />;
}
