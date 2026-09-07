import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ServiceDetailPage } from "@/components/services/ServiceDetailPage";
import {
  getIndexablePageLocales,
  getIndexableServiceLocales,
  getLivePageContent,
  getPublishedServiceByPath,
} from "@/lib/live-content";
import { excerpt } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import { routing, type Locale } from "@/i18n/routing";
import { PUBLIC_PATHS, serviceLandingContentPath } from "@/lib/public-routes";
import { ENDOSPHERES_EN } from "@/content/endospheres";
import { ContentPage } from "@/components/ContentPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const requestedPath = `${PUBLIC_PATHS.services}/${slug}`;
  const path = serviceLandingContentPath(requestedPath);
  const contentSlug = path.slice(`${PUBLIC_PATHS.services}/`.length);
  const fallbackSlug = `services/${contentSlug === "lahjakortit" ? "gift-cards" : contentSlug}`;
  const [c, fallback, serviceLocales, pageLocales] = await Promise.all([
    getPublishedServiceByPath(path, locale as Locale),
    getLivePageContent(fallbackSlug, locale as Locale),
    getIndexableServiceLocales(path),
    getIndexablePageLocales(fallbackSlug),
  ]);
  const availableLocales = c ? serviceLocales : pageLocales;
  if (locale === "en" && path.endsWith("/endospheres-terapia")) {
    return managedLocalizedMetadata({
      locale: "en",
      path,
      title: ENDOSPHERES_EN.title,
      description: ENDOSPHERES_EN.sections[0].paragraphs[0],
      image: c?.content.ogImage || c?.images[0],
      imageAlt: c?.content.imageAlt || ENDOSPHERES_EN.title,
      indexable: c?.content.seoIndexable ?? false,
      availableLocales,
    });
  }
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path,
    title:
      c?.content.seoTitle ||
      c?.content.h1 ||
      fallback?.seoTitle ||
      fallback?.title,
    description:
      c?.content.seoDescription ||
      (c
        ? excerpt(c.content.shortDesc || c.content.whatItIs)
        : fallback?.seoDescription ||
          (fallback ? excerpt(fallback.body) : undefined)),
    image: c?.content.ogImage || c?.images[0] || fallback?.hero,
    imageAlt:
      c?.content.imageAlt ||
      c?.content.h1 ||
      fallback?.imageAlt ||
      fallback?.title,
    indexable: c?.content.seoIndexable ?? fallback?.seoIndexable ?? false,
    availableLocales,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  if (slug === "lahjakortit")
    return <ContentPage slug="services/gift-cards" locale={locale as Locale} />;
  const path = serviceLandingContentPath(`${PUBLIC_PATHS.services}/${slug}`);
  return <ServiceDetailPage slug={path.slice(1)} locale={locale as Locale} />;
}
