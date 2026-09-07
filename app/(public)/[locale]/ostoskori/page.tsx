import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ShoppingCartSimple } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { BasketClient } from "@/components/shop/BasketClient";
import { localeAlternates } from "@/lib/seo";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Basket" });
  return {
    title: t("metaTitle"),
    alternates: localeAlternates(PUBLIC_PATHS.basket, locale),
    robots: { index: false },
  };
}

export default async function BasketPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Basket");

  return (
    <section className="bg-page py-[clamp(60px,8vw,120px)]">
      <Container className="max-w-[640px] text-center">
        <ShoppingCartSimple
          size={40}
          weight="thin"
          className="mx-auto text-accent"
        />
        <h1 className="mt-[16px] font-display text-h2 leading-[1.06] font-medium text-ink">
          {t("heading")}
        </h1>
      </Container>
      <Container className="mt-[clamp(28px,4vw,48px)]">
        <BasketClient />
      </Container>
    </section>
  );
}
