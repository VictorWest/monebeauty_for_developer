import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ProductCard } from "@/components/shop/ProductCard";
import type { ProductCategory } from "@/content/products";
import { getLiveProducts } from "@/lib/live-content";
import { absoluteLocalizedUrl, collectionJsonLd, siteUrl } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import { JsonLd } from "@/components/JsonLd";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS, productPath } from "@/lib/public-routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Catalog" });
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.shop,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const GROUPS: { category: ProductCategory; labelKey: string }[] = [
  { category: "AROSHA_BODY", labelKey: "categoryBody" },
  { category: "DIXIDOX_TRICHO", labelKey: "categoryTricho" },
  { category: "GIFT_CARD", labelKey: "categoryGiftCards" },
  { category: "TREATMENT", labelKey: "categoryTreatments" },
  { category: "OTHER", labelKey: "categoryOther" },
];

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Catalog");
  const l = locale as Locale;
  const products = await getLiveProducts(l);

  return (
    <section className="bg-page py-[clamp(40px,5vw,72px)]">
      <JsonLd
        data={collectionJsonLd({
          name: t("title"),
          url: absoluteLocalizedUrl(siteUrl(), PUBLIC_PATHS.shop, l),
          items: products.map((product) => ({
            name: product.i18n[l]?.name || product.slug,
            url: absoluteLocalizedUrl(siteUrl(), productPath(product.slug), l),
          })),
        })}
      />
      <Container>
        <Eyebrow className="mb-[14px]">{t("title")}</Eyebrow>
        <h1 className="font-display text-h2 leading-[1.06] font-medium text-ink">
          {t("title")}
        </h1>
        <p className="mt-[16px] max-w-[620px] font-sans text-lead font-light text-body">
          {t("intro")}
        </p>

        {GROUPS.map(({ category, labelKey }) => {
          const items = products.filter((p) => p.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mt-[clamp(36px,4vw,56px)]">
              <h2 className="mb-[clamp(20px,2vw,28px)] font-display text-h2-tech font-medium text-ink">
                {t(labelKey)}
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[clamp(16px,1.8vw,26px)]">
                {items.map((p) => (
                  <ProductCard
                    key={p.slug}
                    product={p}
                    locale={l}
                    intoBasket={t("intoBasket")}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </Container>
    </section>
  );
}
