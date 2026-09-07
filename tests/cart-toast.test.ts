import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const provider = readFileSync("components/shop/CartProvider.tsx", "utf8");
const toast = readFileSync("components/shop/CartAddedToast.tsx", "utf8");

test("adding a known product opens the shared localized cart toast", () => {
  assert.match(provider, /<CartAddedToast/);
  assert.match(
    provider,
    /products\.find\(\(product\) => product\.slug === slug\)/,
  );
  assert.match(
    provider,
    /setNotice\(\{ id: noticeSequence\.current, productName \}\)/,
  );
});

test("cart toast is accessible and links to the canonical basket", () => {
  assert.match(toast, /role="status"/);
  assert.match(toast, /aria-live="polite"/);
  assert.match(toast, /href=\{PUBLIC_PATHS\.basket\}/);
  assert.match(toast, /onFocusCapture=\{pauseTimer\}/);
  assert.match(toast, /aria-label=\{t\("dismiss"\)\}/);
});

test("cart toast translations exist in every public locale", () => {
  for (const locale of ["en", "fi", "ru"]) {
    const messages = JSON.parse(
      readFileSync(`messages/${locale}.json`, "utf8"),
    ) as { Cart?: Record<string, string> };
    assert.ok(messages.Cart?.addedToBasket?.includes("{name}"), locale);
    assert.ok(messages.Cart?.viewBasket, locale);
    assert.ok(messages.Cart?.dismiss, locale);
  }
});
