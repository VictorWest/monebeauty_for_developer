"use client";

import { ShoppingCartSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/shop/CartProvider";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export function HeaderCartLink() {
  const t = useTranslations("Cart");
  const { count } = useCart();

  return (
    <Link
      href={PUBLIC_PATHS.basket}
      aria-label={t("openBasket", { count })}
      className="relative grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-[4px] text-nav transition-colors hover:bg-alt hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <ShoppingCartSimple size={22} weight="thin" />
      {count > 0 ? (
        <span
          aria-live="polite"
          className="absolute top-[2px] right-[1px] grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-[5px] font-sans text-[10px] leading-none font-medium text-page"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
