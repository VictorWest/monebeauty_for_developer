import { getTranslations, getLocale } from "next-intl/server";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/shop/ProductCard";
import { getProduct, HOME_PRODUCT_SLUGS } from "@/content/products";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export async function AroshaShowcase() {
  const t = await getTranslations("Home");
  const tCat = await getTranslations("Catalog");
  const tc = await getTranslations("Common");
  const locale = (await getLocale()) as Locale;

  const products = HOME_PRODUCT_SLUGS.map(getProduct).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );

  return (
    <section className="bg-alt py-[clamp(56px,7vw,104px)]">
      <Container>
        <Eyebrow className="mb-[14px]">{t("aroshaEyebrow")}</Eyebrow>
        <h2 className="font-display text-h2-treat font-medium text-ink">
          {t("aroshaHeading")}
        </h2>
        <p className="mt-[16px] max-w-[720px] font-sans text-[15px] leading-[1.75] font-light text-body">
          {t("aroshaIntro")}
        </p>

        <div className="mt-[clamp(32px,4vw,52px)] grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[clamp(16px,1.8vw,26px)]">
          {products.map((p) => (
            <ProductCard
              key={p.slug}
              product={p}
              locale={locale}
              intoBasket={tCat("intoBasket")}
            />
          ))}
        </div>

        <div className="mt-[clamp(32px,3vw,44px)] flex justify-center">
          <Button href={PUBLIC_PATHS.shop} iconRight={ArrowRight}>
            {tc("seeMore")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
