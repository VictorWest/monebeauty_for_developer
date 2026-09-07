import { notFound } from "next/navigation";
import { AdminRouter } from "@/components/admin/AdminRouter";

export default async function LocalizedAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, segments = [] } = await params;
  if (locale !== "en" && locale !== "ru") notFound();
  return <AdminRouter locale={locale} segments={segments} searchParams={await searchParams} />;
}

