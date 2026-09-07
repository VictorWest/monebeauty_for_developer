import assert from "node:assert/strict";
import test from "node:test";
import type { Product } from "../content/products";
import {
  cartItemCount,
  cartSubtotal,
  normalizeQty,
  resolveCartLines,
} from "../lib/cart";

const products: Product[] = [
  {
    slug: "one",
    category: "AROSHA_BODY",
    image: null,
    price: 12,
    size: "100 ml",
    i18n: {
      en: { name: "One", description: "" },
      fi: { name: "One", description: "" },
      ru: { name: "One", description: "" },
    },
  },
  {
    slug: "two",
    category: "DIXIDOX_TRICHO",
    image: null,
    price: 20,
    size: null,
    i18n: {
      en: { name: "Two", description: "" },
      fi: { name: "Two", description: "" },
      ru: { name: "Two", description: "" },
    },
  },
];

test("cart badge count sums quantities rather than distinct product lines", () => {
  const lines = resolveCartLines(
    [
      { slug: "one", qty: 2 },
      { slug: "two", qty: 3 },
    ],
    products,
  );
  assert.equal(cartItemCount(lines), 5);
  assert.equal(cartSubtotal(lines), 84);
});

test("cart ignores unavailable products and normalizes persisted quantities", () => {
  const lines = resolveCartLines(
    [
      { slug: "missing", qty: 8 },
      { slug: "one", qty: 500 },
    ],
    products,
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.qty, 99);
  assert.equal(normalizeQty(Number.NaN), 1);
});
