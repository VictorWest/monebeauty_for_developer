import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { TreatmentDetailPage } from "@/components/services/TreatmentDetailPage";
import {
  getIndexableServiceOptionLocales,
  getPublishedServiceOption,
} from "@/lib/live-content";
import { routing, type Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import { PUBLIC_PATHS, treatmentOptionPath } from "@/lib/public-routes";

function paths(slug: string, optionKey: string) {
  const servicePath = `${PUBLIC_PATHS.services}/${slug}`;
  return {
    servicePath,
    optionPath: treatmentOptionPath(servicePath, optionKey),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; optionKey: string }>;
}): Promise<Metadata> {
  const { locale, slug, optionKey } = await params;
  if (!routing.locales.includes(locale as Locale)) return {};
  const { servicePath, optionPath } = paths(slug, optionKey);
  const [option, availableLocales] = await Promise.all([
    getPublishedServiceOption(servicePath, optionKey, locale as Locale),
    getIndexableServiceOptionLocales(servicePath, optionKey),
  ]);
  if (!option) return {};
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: optionPath,
    title: `${option.content.name} | ${option.service.content.h1}`,
    description: option.content.summary || option.content.description,
    image: option.image || option.service.images[0],
    imageAlt: option.content.imageAlt || option.content.name,
    indexable: option.service.content.seoIndexable,
    availableLocales,
  });
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; optionKey: string }>;
  searchParams: Promise<{ localeSwitch?: string }>;
}) {
  const { locale, slug, optionKey } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const { servicePath, optionPath } = paths(slug, optionKey);
  const option = await getPublishedServiceOption(
    servicePath,
    optionKey,
    locale as Locale,
  );
  const switched = (await searchParams).localeSwitch === "1";
  if (!option) {
    if (switched) redirect(localizedPath(servicePath, locale));
    notFound();
  }
  if (switched) redirect(localizedPath(optionPath, locale));
  return (
    <TreatmentDetailPage
      option={option}
      locale={locale as Locale}
      servicePath={servicePath}
      optionPath={optionPath}
    />
  );
}
