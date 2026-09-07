import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cormorant, inter, jost } from "@/lib/fonts";
import "../../../globals.css";

export const metadata: Metadata = {
  title: "Admin · Mone Beauty Clinic",
  robots: { index: false, follow: false },
};

export default async function LocalizedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "ru") notFound();
  return (
    <html
      lang={locale}
      className={`${cormorant.variable} ${jost.variable} ${inter.variable} h-full`}
    >
      <body className="admin-app min-h-full bg-page text-ink">{children}</body>
    </html>
  );
}
