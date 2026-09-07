import { AdminRouter } from "@/components/admin/AdminRouter";

export default async function FinnishAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { segments = [] } = await params;
  return <AdminRouter locale="fi" segments={segments} searchParams={await searchParams} />;
}

