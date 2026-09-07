import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { staffHref } from "@/lib/account-routing";
import { adminBase } from "@/lib/admin-routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Staff" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function StaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await currentUser("backoffice");
  const appLocale = locale as "en" | "fi" | "ru";
  if (!user || (user.role !== "STAFF" && user.role !== "ADMIN"))
    redirect(staffHref(appLocale, "login"));
  if (user.role === "STAFF" && user.mustChangePassword)
    redirect(staffHref(appLocale, "password"));
  redirect(adminBase(appLocale));
}
