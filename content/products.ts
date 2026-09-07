import type { Locale } from "@/i18n/routing";
import productsData from "./generated/products.json";

export type ProductCategory =
  "AROSHA_BODY" | "DIXIDOX_TRICHO" | "GIFT_CARD" | "TREATMENT" | "OTHER";
export type ProductKind = "PHYSICAL" | "GIFT_CARD" | "TREATMENT_VOUCHER";

export interface Product {
  slug: string;
  category: ProductCategory;
  kind?: ProductKind;
  image: string | null;
  imageFocalX?: number;
  imageFocalY?: number;
  price: number | null;
  size: string | null;
  currency?: string;
  updatedAt?: Date;
  i18n: Record<
    Locale,
    {
      name: string;
      description: string;
      shortDescription?: string | null;
      imageAlt?: string | null;
      seoTitle?: string | null;
      seoDescription?: string | null;
      seoIndexable?: boolean;
      updatedAt?: Date;
    }
  >;
}

export const PRODUCTS = productsData as Product[];
export const PRODUCT_SLUGS = PRODUCTS.map((p) => p.slug);

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

/** The 8 products featured on the homepage (matching the live site). */
export const HOME_PRODUCT_SLUGS = [
  "stretch-marks-200ml-1",
  "518-b-tone-100ml-3",
  "cellulite-200ml-4",
  "lipolytic-200ml-5",
  "peeling-120ml-6",
  "nio-drain-9",
  "516-cellunight-200ml-night-10",
  "breast-amp-decollete-11",
];

export function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `${price.toFixed(2)} €`;
}
