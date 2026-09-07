import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { TechnologyDetailPage } from "@/components/technology/TechnologyDetailPage";
import {
  getIndexableTechnologyLocales,
  getPublishedTechnologyByPath,
} from "@/lib/live-content";
import { excerpt } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import { routing, type Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { ENDOSPHERES_EN } from "@/content/endospheres";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const path = `${PUBLIC_PATHS.technologies}/${slug}`;
  const [technology, availableLocales] = await Promise.all([
    getPublishedTechnologyByPath(path, locale as Locale),
    getIndexableTechnologyLocales(path),
  ]);
  if (locale === "en" && slug === "endospheres") {
    return managedLocalizedMetadata({
      locale: "en",
      path,
      title: ENDOSPHERES_EN.title,
      description: ENDOSPHERES_EN.sections[0].paragraphs[0],
      image: technology?.images[0],
      imageAlt: technology?.content.imageAlt || ENDOSPHERES_EN.title,
      indexable: technology?.content.seoIndexable ?? false,
      availableLocales,
    });
  }
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path,
    title: technology?.content.seoTitle || technology?.content.name,
    description:
      technology?.content.seoDescription ||
      (technology
        ? excerpt(technology.content.summary || technology.content.body)
        : undefined),
    image: technology?.images[0],
    imageAlt: technology?.content.imageAlt || technology?.content.name,
    indexable: technology?.content.seoIndexable ?? false,
    availableLocales,
  });
}

export default async function TechnologyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  return (
    <TechnologyDetailPage
      path={`${PUBLIC_PATHS.technologies}/${slug}`}
      locale={locale as Locale}
    />
  );
}
