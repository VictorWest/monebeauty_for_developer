import type { Product } from "@/content/products";

export type CartItemInput = {
  slug: string;
  qty: number;
};

export type CartLine = {
  product: Product;
  qty: number;
  lineTotal: number;
};

export const CART_STORAGE_KEY = "monebeauty.cart.v1";

export function normalizeQty(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(99, Math.max(1, Math.floor(value)));
}

export function resolveCartLines(items: CartItemInput[], products: Product[]): CartLine[] {
  return items
    .map((item) => {
      const product = products.find((p) => p.slug === item.slug);
      if (!product || product.price == null) return null;
      const qty = normalizeQty(item.qty);
      return {
        product,
        qty,
        lineTotal: product.price * qty,
      };
    })
    .filter((line): line is CartLine => Boolean(line));
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}
