import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  checkoutCancelTokenHash,
  createCheckoutCancelToken,
  eurosToMinor,
  minorToEuros,
} from "../lib/stripe";

const webhook = readFileSync("app/api/webhooks/stripe/route.ts", "utf8");
const payments = readFileSync("lib/stripe-payments.ts", "utf8");
const checkout = readFileSync("app/api/checkout/route.ts", "utf8");
const checkoutForm = readFileSync("components/shop/CheckoutForm.tsx", "utf8");
const cancellation = readFileSync("app/api/checkout/cancel/route.ts", "utf8");
const operations = readFileSync("components/admin/AdminOperations.tsx", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const seed = readFileSync("prisma/seed.ts", "utf8");

test("EUR conversion is exact and rejects excessive precision", () => {
  assert.equal(eurosToMinor("0"), 0);
  assert.equal(eurosToMinor("39.50"), 3950);
  assert.equal(eurosToMinor("1000.1"), 100010);
  assert.equal(minorToEuros(3950), "39.50");
  assert.throws(() => eurosToMinor("1.001"));
  assert.throws(() => eurosToMinor("-1"));
});

test("Stripe webhook verifies raw signatures and records event ids", () => {
  assert.match(webhook, /await req\.text\(\)/);
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /stripeWebhookEvent\.upsert/);
  assert.match(webhook, /existing\?\.status === "COMPLETED"/);
  assert.match(webhook, /checkout\.session\.async_payment_succeeded/);
  assert.match(webhook, /refund\.updated/);
});

test("website checkout owns prices and appointments remain outside Stripe", () => {
  assert.match(checkout, /prisma\.product\.findMany/);
  assert.match(checkout, /unit_amount: eurosToMinor\(product\.price\)/);
  assert.match(checkout, /metadata = \{[\s\S]*?source: "website"/);
  assert.doesNotMatch(checkout, /appointment/i);
  assert.match(payments, /stripe_session_amount_mismatch/);
  assert.match(payments, /item\.vouchers\.length >= item\.qty/);
});

test("the seeded one-euro Stripe test item is localized, opt-in, and never indexable", () => {
  assert.match(
    seed,
    /where: \{ slug: "stripe-checkout-test-item" \},[\s\S]*?published: process\.env\.SEED_STRIPE_TEST_PRODUCT === "true",[\s\S]*?create: \{[\s\S]*?category: "OTHER",[\s\S]*?kind: "PHYSICAL",[\s\S]*?price: 1,[\s\S]*?currency: "EUR",[\s\S]*?published: process\.env\.SEED_STRIPE_TEST_PRODUCT === "true",/,
  );
  assert.match(seed, /name: "Stripe-testituote 1 €"/);
  assert.match(seed, /name: "Stripe checkout test item €1"/);
  assert.match(seed, /name: "Тестовый товар Stripe за 1 €"/);
  assert.match(
    seed,
    /productId: stripeCheckoutTestProduct\.id,[\s\S]*?update: \{\},[\s\S]*?seoIndexable: false,[\s\S]*?status: "PUBLISHED"/,
  );
  assert.doesNotMatch(
    seed,
    /where: \{ slug: "stripe-checkout-test-item" \},\s*update: \{[^}]*archivedAt/,
  );
});

test("checkout does not require an address label", () => {
  assert.doesNotMatch(checkoutForm, /t\("address\.label"\)/);
  assert.doesNotMatch(checkoutForm, /shippingAddress\.label/);
  assert.match(
    checkout,
    /label: String\(rawAddress\.label \?\? "Home"\)[\s\S]*?\.trim\(\)/,
  );
});

test("checkout has one strict international phone path", () => {
  assert.match(checkoutForm, /normalizeCheckoutPhone\(form\.phone\)/);
  assert.match(checkoutForm, /aria-invalid=\{Boolean\(fieldErrors\.phone\)\}/);
  assert.match(checkoutForm, /placeholder="\+358 40 123 4567"/);
  assert.match(checkoutForm, /maxLength=\{32\}/);
  assert.doesNotMatch(checkoutForm, /shippingAddress\.phone/);
  assert.doesNotMatch(checkoutForm, /shipping_phone_invalid/);
  assert.doesNotMatch(checkout, /rawAddress\.phone/);
  assert.doesNotMatch(checkout, /shipping_phone_invalid/);
  assert.match(
    checkout,
    /normalizeCheckoutPhone\(String\(payload\.phone \?\? ""\)\)/,
  );
  assert.match(
    checkout,
    /recipientName: selectedAddress\.recipientName,\s*phone,/,
  );
  assert.match(
    checkout,
    /\{ name: selectedAddress\.recipientName, phone, address \}/,
  );
});

test("checkout reveals localized field validation without native browser bubbles", () => {
  assert.match(checkoutForm, /noValidate/);
  assert.match(checkoutForm, /validateCheckoutFields/);
  assert.match(checkoutForm, /firstCheckoutValidationError/);
  assert.match(checkoutForm, /scrollIntoView/);
  assert.match(checkoutForm, /prefers-reduced-motion: reduce/);
  assert.match(checkoutForm, /data-checkout-field="phone"/);
  assert.match(checkoutForm, /data-checkout-field="consent"/);
  assert.match(checkoutForm, /disabled=\{submitting\}/);
});

test("checkout reuses its normalized phone across order and delivery persistence", () => {
  assert.match(
    checkout,
    /const phone = normalizeCheckoutPhone\(String\(payload\.phone \?\? ""\)\)/,
  );
  assert.doesNotMatch(checkout, /accountClient\?\.phone \?\? payload\.phone/);
  assert.match(checkout, /const oneOffAddress = rawAddress[\s\S]*?phone,/);
  assert.match(
    checkout,
    /shippingAddress: selectedAddress[\s\S]*?recipientName: selectedAddress\.recipientName,[\s\S]*?phone,/,
  );
  assert.match(
    checkout,
    /stripeClient\(\)\.customers\.update[\s\S]*?phone,[\s\S]*?\{ address, shipping \}/,
  );
  assert.match(
    checkout,
    /stripeClient\(\)\.customers\.create[\s\S]*?phone,[\s\S]*?\{ address, shipping \}/,
  );
  assert.match(
    checkout,
    /prisma\.savedAddress\.create\(\{[\s\S]*?\.\.\.oneOffAddress/,
  );
  assert.match(
    checkout,
    /prisma\.savedAddress\.update\(\{[\s\S]*?data: \{ lastUsedAt: new Date\(\) \}/,
  );
  assert.doesNotMatch(
    checkout,
    /prisma\.savedAddress\.update\(\{[\s\S]*?data: \{[\s\S]*?phone/,
  );
});

test("checkout cancellation tokens are opaque and stored only as hashes", () => {
  const first = createCheckoutCancelToken();
  const second = createCheckoutCancelToken();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(first.hash, checkoutCancelTokenHash(first.token));
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.hash, second.hash);
  assert.match(schema, /checkoutCancelTokenHash\s+String\?\s+@unique/);
  assert.match(schema, /cancelRequestedAt\s+DateTime\?/);
  assert.match(schema, /FAILED\s+CANCELLED\s+EXPIRED/);
});

test("Stripe return expires the session and leaves order state to the webhook", () => {
  assert.match(checkout, /new URL\("\/api\/checkout\/cancel", siteUrl\(\)\)/);
  assert.match(checkout, /checkoutCancelTokenHash: cancellation\.hash/);
  assert.doesNotMatch(checkout, /status: "PROCESSING"/);
  assert.match(cancellation, /checkoutCancelTokenHash\(token\)/);
  assert.match(cancellation, /cancelRequestedAt: new Date\(\)/);
  assert.match(cancellation, /checkout\.sessions\.expire\(session\.id\)/);
  assert.match(cancellation, /checkoutCancelTokenHash: null/);
  assert.doesNotMatch(cancellation, /prisma\.order\.(?:update|updateMany)/);
  assert.match(
    payments,
    /status === "EXPIRED" && attempt\.cancelRequestedAt \? "CANCELLED" : status/,
  );
  assert.match(payments, /customer_cancelled_stripe_checkout/);
});

test("admin derives and filters the awaiting-payment order state", () => {
  assert.match(
    operations,
    /const orderFilterStatuses = \["AWAITING_PAYMENT", \.\.\.orderStatuses\]/,
  );
  assert.match(
    operations,
    /source === "WEBSITE_STRIPE"[\s\S]*?order\.status === "PENDING"[\s\S]*?\["UNPAID", "PROCESSING"\]/,
  );
  assert.match(
    operations,
    /source: "WEBSITE_STRIPE",[\s\S]*?status: "PENDING",[\s\S]*?paymentStatus: \{ in: \["UNPAID", "PROCESSING"\] \}/,
  );
});
