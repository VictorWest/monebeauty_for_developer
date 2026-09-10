import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { cormorant, jost } from "@/lib/fonts";
import { routing } from "@/i18n/routing";
import { BRAND } from "@/content/site";
import { siteUrl } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import type { Locale } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChatWidget } from "@/components/ui/ChatWidget";
import { CartProvider } from "@/components/shop/CartProvider";
import { Analytics } from "@/components/privacy/Analytics";
import { CookieConsent } from "@/components/privacy/CookieConsent";
import { getLiveProducts } from "@/lib/live-content";
import "../../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  const title = `${BRAND.name}: ${t("metaTitle")}`;
  const base = await managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.home,
    title,
    description: t("metaDescription"),
  });
  return {
    ...base,
    metadataBase: new URL(siteUrl()),
    title: {
      default: title,
      template: `%s · ${BRAND.shortName}`,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const products = await getLiveProducts(locale);

  return (
    <html
      lang={locale}
      className={`${cormorant.variable} ${jost.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <CartProvider products={products}>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <ChatWidget />
            <CookieConsent />
            <Analytics />
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
