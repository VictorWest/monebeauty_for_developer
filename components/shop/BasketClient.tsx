"use client";

import Image from "next/image";
import { Minus, Plus, Trash, ArrowRight } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/shop/CartProvider";
import { formatPrice } from "@/content/products";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS, productPath } from "@/lib/public-routes";

export function BasketClient() {
  const t = useTranslations("Basket");
  const cart = useCart();
  const locale = useLocale() as Locale;

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-[440px] text-center">
        <p className="font-sans text-lead font-light text-body">{t("empty")}</p>
        <div className="mt-[28px]">
          <Link
            href={PUBLIC_PATHS.shop}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[4px] bg-accent px-[30px] py-[14px] font-sans text-[12px] font-medium tracking-[.16em] text-page uppercase transition-colors hover:[background:color-mix(in_srgb,var(--accent)_86%,#000)]"
          >
            {t("browse")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-[clamp(24px,4vw,48px)] lg:grid-cols-[1fr_360px]">
      <div className="space-y-[14px]">
        {cart.lines.map(({ product, qty, lineTotal }) => {
          const content = product.i18n[locale];
          const name = content?.name ?? product.slug;
          return (
            <article
              key={product.slug}
              className="grid gap-[16px] rounded-[var(--radius)] border border-line-card bg-card p-[16px] sm:grid-cols-[116px_1fr_auto]"
            >
              <Link
                href={productPath(product.slug)}
                className="relative h-[116px] overflow-hidden rounded-[8px] bg-page"
              >
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={content?.imageAlt || name}
                    fill
                    className="object-contain p-[14px]"
                    sizes="116px"
                  />
                ) : null}
              </Link>
              <div>
                <Link
                  href={productPath(product.slug)}
                  className="font-display text-[20px] leading-[1.2] font-medium text-ink transition-colors hover:text-accent"
                >
                  {name}
                </Link>
                {product.size ? (
                  <p className="mt-[6px] font-sans text-label tracking-[.06em] text-muted">
                    {product.size}
                  </p>
                ) : null}
                <p className="mt-[8px] font-sans text-[14px] text-body">
                  {formatPrice(product.price)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-[16px] sm:flex-col sm:items-end">
                <div className="flex min-h-[44px] items-center rounded-[4px] border border-line-btn bg-page">
                  <button
                    type="button"
                    onClick={() =>
                      qty <= 1
                        ? cart.remove(product.slug)
                        : cart.setQty(product.slug, qty - 1)
                    }
                    aria-label={t("decrease")}
                    className="grid h-[44px] w-[44px] place-items-center text-ink hover:text-accent"
                  >
                    <Minus size={15} weight="thin" />
                  </button>
                  <span className="min-w-[34px] text-center font-sans text-[14px] text-ink">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => cart.setQty(product.slug, qty + 1)}
                    aria-label={t("increase")}
                    className="grid h-[44px] w-[44px] place-items-center text-ink hover:text-accent"
                  >
                    <Plus size={15} weight="thin" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="font-sans text-[15px] font-medium text-ink">
                    {formatPrice(lineTotal)}
                  </p>
                  <button
                    type="button"
                    onClick={() => cart.remove(product.slug)}
                    className="mt-[8px] inline-flex min-h-[32px] items-center gap-[6px] font-sans text-[12px] text-muted transition-colors hover:text-accent"
                  >
                    <Trash size={14} weight="thin" />
                    {t("remove")}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <aside className="h-fit rounded-[var(--radius)] border border-line-card bg-card p-[clamp(20px,3vw,28px)]">
        <h2 className="font-display text-[26px] font-medium text-ink">
          {t("summary")}
        </h2>
        <dl className="mt-[20px] space-y-[12px] font-sans text-[14px]">
          <div className="flex justify-between gap-[16px] border-b border-line-hair pb-[12px]">
            <dt className="text-body">{t("items")}</dt>
            <dd className="font-medium text-ink">{cart.count}</dd>
          </div>
          <div className="flex justify-between gap-[16px]">
            <dt className="text-body">{t("subtotal")}</dt>
            <dd className="font-medium text-ink">
              {formatPrice(cart.subtotal)}
            </dd>
          </div>
        </dl>
        <Link
          href={PUBLIC_PATHS.checkout}
          className="mt-[24px] inline-flex min-h-[44px] w-full items-center justify-center gap-[9px] rounded-[4px] bg-accent px-[24px] py-[14px] font-sans text-[12px] font-medium tracking-[.16em] text-page uppercase transition-colors hover:[background:color-mix(in_srgb,var(--accent)_86%,#000)]"
        >
          {t("checkout")}
          <ArrowRight size={16} weight="thin" />
        </Link>
      </aside>
    </div>
  );
}
