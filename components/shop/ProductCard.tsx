import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { formatPrice, type Product } from "@/content/products";
import type { Locale } from "@/i18n/routing";
import { productPath } from "@/lib/public-routes";

/** AROSHA / DIXIDOX product card (image, name, size, price, basket button). */
export function ProductCard({
  product,
  locale,
  intoBasket,
}: {
  product: Product;
  locale: Locale;
  intoBasket: string;
}) {
  const localized = product.i18n[locale];
  if (!localized) return null;
  const name = localized.name;
  const href = productPath(product.slug);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[var(--radius)] border border-line-card bg-card transition-all duration-300 hover:-translate-y-[4px] hover:border-line-card-hover hover:shadow-[var(--shadow-card)]">
      <div className="relative flex h-[240px] items-center justify-center bg-page">
        {product.image ? (
          <Image
            src={product.image}
            alt={localized.imageAlt || name}
            fill
            className="object-contain p-[22px]"
            sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, 25vw"
            style={{
              objectPosition: `${product.imageFocalX ?? 50}% ${product.imageFocalY ?? 50}%`,
            }}
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col items-center px-[16px] pt-[14px] pb-[20px] text-center">
        <Link
          href={href}
          className="card-stretch font-display text-[16px] leading-[1.25] font-medium text-ink uppercase transition-colors group-hover:text-accent"
        >
          {name}
        </Link>
        {product.size ? (
          <div className="mt-[6px] font-sans text-label tracking-[.06em] text-muted">
            {product.size}
          </div>
        ) : null}
        <div className="mt-[8px] font-sans text-[15px] text-ink">
          {formatPrice(product.price)}
        </div>
        <div className="mt-auto">
          <AddToCartButton
            slug={product.slug}
            label={intoBasket}
            className="relative z-[2]"
          />
        </div>
      </div>
    </div>
  );
}
