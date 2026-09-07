import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Markdown } from "@/components/Markdown";
import { ProductCard } from "@/components/shop/ProductCard";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/content/products";
import {
  getIndexableProductLocales,
  getLiveProduct,
  getLiveProducts,
} from "@/lib/live-content";
import {
  absoluteLocalizedUrl,
  breadcrumbJsonLd,
  productJsonLd,
  siteUrl,
} from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import { JsonLd } from "@/components/JsonLd";
import { routing, type Locale } from "@/i18n/routing";
import { PUBLIC_PATHS, productPath } from "@/lib/public-routes";

const SITE = siteUrl();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [p, availableLocales] = await Promise.all([
    getLiveProduct(slug, locale as Locale),
    getIndexableProductLocales(slug),
  ]);
  if (!p) return {};
  const c = p.i18n[locale as Locale];
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: productPath(slug),
    title: c?.seoTitle || c?.name,
    description: c?.seoDescription || c?.shortDescription || c?.description,
    image: p.image,
    imageAlt: c?.imageAlt || c?.name,
    indexable: c?.seoIndexable ?? false,
    availableLocales,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  const l = locale as Locale;
  const product = await getLiveProduct(slug, l);
  if (!product) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Product");
  const c = product.i18n[l];
  if (!c) notFound();
  const products = await getLiveProducts(l);
  const related = products
    .filter((p) => p.slug !== slug && p.category === product.category)
    .slice(0, 4);

  return (
    <section className="bg-page py-[clamp(32px,4vw,64px)]">
      <Container>
        <JsonLd
          data={[
            productJsonLd({
              name: c.name,
              description: c.description?.slice(0, 300) ?? c.name,
              url: absoluteLocalizedUrl(SITE, productPath(slug), locale),
              image: product.image,
              price: product.price ?? 0,
              currency: product.currency || "EUR",
              brand:
                product.category === "AROSHA_BODY"
                  ? "AROSHA"
                  : product.category === "DIXIDOX_TRICHO"
                    ? "DIXIDOX De Luxe"
                    : "Mone Beauty Clinic",
            }),
            breadcrumbJsonLd([
              {
                name: "Mone Beauty Clinic",
                url: absoluteLocalizedUrl(SITE, "/", locale),
              },
              {
                name: t("backToCatalog"),
                url: absoluteLocalizedUrl(SITE, PUBLIC_PATHS.shop, locale),
              },
              {
                name: c.name,
                url: absoluteLocalizedUrl(SITE, productPath(slug), locale),
              },
            ]),
          ]}
        />
        <Link
          href={PUBLIC_PATHS.shop}
          className="inline-flex items-center gap-[6px] font-sans text-[12px] tracking-[.12em] text-muted uppercase transition-colors hover:text-accent"
        >
          <ArrowLeft size={14} weight="thin" />
          {t("backToCatalog")}
        </Link>

        <div className="mt-[24px] grid grid-cols-1 gap-[clamp(28px,4vw,56px)] lg:grid-cols-2">
          <div className="relative h-[clamp(320px,42vw,520px)] overflow-hidden rounded-[var(--radius)] border border-line-card bg-alt">
            {product.image ? (
              <Image
                src={product.image}
                alt={c.imageAlt || c.name}
                fill
                priority
                className="object-contain p-[clamp(24px,4vw,56px)]"
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{
                  objectPosition: `${product.imageFocalX ?? 50}% ${product.imageFocalY ?? 50}%`,
                }}
              />
            ) : null}
          </div>

          <div className="flex flex-col">
            <h1 className="font-display text-[clamp(26px,3vw,40px)] leading-[1.1] font-medium text-ink">
              {c.name}
            </h1>
            {product.size ? (
              <div className="mt-[10px] font-sans text-[13px] tracking-[.06em] text-muted">
                {product.size}
              </div>
            ) : null}
            <div className="mt-[14px] font-display text-[28px] font-medium text-ink">
              {formatPrice(product.price)}
            </div>
            <AddToCartButton
              slug={product.slug}
              label={t("intoBasket")}
              compact={false}
              className="mt-[24px]"
            />

            {c.description ? (
              <div className="mt-[clamp(28px,3vw,40px)]">
                <h2 className="font-display text-[22px] font-medium text-ink">
                  {t("description")}
                </h2>
                <Markdown>{c.description}</Markdown>
              </div>
            ) : null}
          </div>
        </div>

        {related.length > 0 ? (
          <div className="mt-[clamp(48px,6vw,80px)]">
            <h2 className="mb-[clamp(20px,2vw,28px)] font-display text-h2-treat font-medium text-ink">
              {t("seeAlso")}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[clamp(16px,1.8vw,26px)]">
              {related.map((p) => (
                <ProductCard
                  key={p.slug}
                  product={p}
                  locale={l}
                  intoBasket={t("intoBasket")}
                />
              ))}
            </div>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
