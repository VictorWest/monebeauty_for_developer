import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { managedLocalizedMetadata } from "@/lib/site-media";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const body = t.raw("privacyBody") as string[];
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.privacy,
    title: t("privacyTitle"),
    description: body.join(" "),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal");
  return (
    <LegalPage
      title={t("privacyTitle")}
      lastUpdatedLabel={t("lastUpdated")}
      date="2026-07-01"
      body={t.raw("privacyBody")}
    />
  );
}
