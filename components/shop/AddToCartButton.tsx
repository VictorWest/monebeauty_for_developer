"use client";

import { useState } from "react";
import { ShoppingCartSimple, Check } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useCart } from "@/components/shop/CartProvider";
import { cn } from "@/lib/cn";

export function AddToCartButton({
  slug,
  label,
  compact = true,
  className,
}: {
  slug: string;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("Cart");
  const cart = useCart();
  const [added, setAdded] = useState(false);

  function add() {
    cart.add(slug);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={add}
        aria-label={added ? t("added") : label}
        title={added ? t("added") : label}
        className={cn(
          "mt-[14px] grid h-[42px] w-[42px] place-items-center rounded-full border border-line-btn text-accent transition-colors hover:border-accent hover:bg-accent hover:text-page",
          added && "border-accent bg-accent text-page",
          className,
        )}
      >
        {added ? (
          <Check size={18} weight="thin" />
        ) : (
          <ShoppingCartSimple size={18} weight="thin" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={add}
      className={cn(
        "inline-flex min-h-[44px] w-fit items-center gap-[10px] rounded-[4px] bg-accent px-[30px] py-[14px] font-sans text-[12px] font-medium tracking-[.16em] text-page uppercase transition-colors hover:[background:color-mix(in_srgb,var(--accent)_86%,#000)]",
        className,
      )}
    >
      {added ? <Check size={16} weight="thin" /> : <ShoppingCartSimple size={16} weight="thin" />}
      {added ? t("added") : label}
    </button>
  );
}
