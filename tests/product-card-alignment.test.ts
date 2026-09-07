import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync("app/globals.css", "utf8");
const home = readFileSync("components/home/HomeReference.tsx", "utf8");
const productCard = readFileSync("components/shop/ProductCard.tsx", "utf8");

test("homepage product actions share the bottom edge of each grid row", () => {
  assert.match(home, /className="hr-product-actions"/);
  assert.match(
    styles,
    /\.hr-products article \{[^}]*display: flex;[^}]*flex-direction: column;/,
  );
  assert.match(
    styles,
    /\.hr-products article > div:last-child \{[^}]*display: flex;[^}]*flex: 1;[^}]*flex-direction: column;/,
  );
  assert.match(
    styles,
    /\.hr-product-actions \{[^}]*margin-top: auto;[^}]*padding-top: 14px;/,
  );
});

test("reusable product cards pin their cart control to the card bottom", () => {
  assert.match(productCard, /<div className="mt-auto">\s*<AddToCartButton/);
  assert.match(productCard, /className="relative z-\[2\]"/);
});

test("homepage product showcase fills balanced rows without markdown artefacts", () => {
  const productGrid =
    styles.match(/\.home-reference \.hr-products \{([^}]*)\}/)?.[1] ?? "";

  assert.match(
    productGrid,
    /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.doesNotMatch(productGrid, /auto-fill/);
  assert.match(
    styles,
    /@media \(min-width: 1040px\) \{\s*\.home-reference \.hr-products \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    home,
    /excerpt\(p\.i18n\[locale\]\?\.description \?\? "", 120\)/,
  );
});

test("homepage products use premium contained-image cards", () => {
  assert.match(
    styles,
    /\.home-reference \.hr-products article \{[^}]*border-radius: var\(--radius\);[^}]*box-shadow: var\(--shadow-card-soft\)/,
  );
  assert.match(
    styles,
    /\.home-reference \.hr-product-image img \{[^}]*object-fit: contain;[^}]*padding: clamp\(/,
  );
  assert.match(
    styles,
    /\.home-reference \.hr-products p \{[^}]*-webkit-line-clamp: 2/,
  );
});
