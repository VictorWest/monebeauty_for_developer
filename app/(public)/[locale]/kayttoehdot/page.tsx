import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";
import { managedLocalizedMetadata } from "@/lib/site-media";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import {
  CANCELLATION_POLICY,
  CANCELLATION_POLICY_ANCHOR,
} from "@/content/cancellation-policy";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  const body = t.raw("termsBody") as string[];
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.terms,
    title: t("termsTitle"),
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
  const policy = CANCELLATION_POLICY[locale as Locale];
  return (
    <LegalPage
      title={t("termsTitle")}
      lastUpdatedLabel={t("lastUpdated")}
      date="2026-07-31"
      body={t.raw("termsBody")}
      sections={[
        {
          id: CANCELLATION_POLICY_ANCHOR,
          title: policy.title,
          paragraphs: [
            policy.deadline,
            policy.lateChange,
            policy.sameDayOrNoShow,
          ],
        },
      ]}
    />
  );
}
