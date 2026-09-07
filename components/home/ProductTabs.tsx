"use client";

import { useState } from "react";
import { ProductCard } from "@/components/shop/ProductCard";
import type { Product, ProductCategory } from "@/content/products";
import type { Locale } from "@/i18n/routing";

export function ProductTabs({
  products,
  locale,
  labels,
  intoBasket,
}: {
  products: Product[];
  locale: Locale;
  labels: Pick<
    Record<ProductCategory, string>,
    "AROSHA_BODY" | "DIXIDOX_TRICHO"
  >;
  intoBasket: string;
}) {
  const [active, setActive] = useState<ProductCategory>("AROSHA_BODY");
  const visible = products
    .filter((product) => product.category === active)
    .slice(0, 8);

  return (
    <>
      <div
        className="mt-[28px] flex border-b border-line-hair"
        role="tablist"
        aria-label="Product lines"
      >
        {(Object.keys(labels) as Array<keyof typeof labels>).map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={active === category}
            onClick={() => setActive(category)}
            className={`min-h-[48px] border-b-2 px-[clamp(18px,3vw,38px)] font-sans text-[12px] font-medium tracking-[.15em] uppercase transition-colors ${active === category ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}
          >
            {labels[category]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        className="mt-[32px] grid grid-cols-2 gap-[clamp(12px,1.8vw,26px)] nav:grid-cols-4 md:grid-cols-3"
      >
        {visible.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            locale={locale}
            intoBasket={intoBasket}
          />
        ))}
      </div>
    </>
  );
}
