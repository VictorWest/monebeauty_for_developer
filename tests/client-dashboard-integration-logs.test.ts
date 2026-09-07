import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const account = readFileSync("app/(public)/[locale]/oma-tili/page.tsx", "utf8");
const actions = readFileSync("lib/client-account-actions.ts", "utf8");
const checkout = readFileSync("app/api/checkout/route.ts", "utf8");
const checkoutForm = readFileSync("components/shop/CheckoutForm.tsx", "utf8");
const bookingPage = readFileSync(
  "app/(public)/[locale]/ajanvaraus/page.tsx",
  "utf8",
);
const logging = readFileSync("lib/external-api.ts", "utf8");
const adminLogs = readFileSync("components/admin/IntegrationLogs.tsx", "utf8");

test("client account exposes the requested dashboard sections and verified identity", () => {
  for (const view of [
    "overview",
    "appointments",
    "orders",
    "addresses",
    "profile",
  ])
    assert.match(account, new RegExp(`"${view}"`));
  assert.match(account, /user\.email/);
  assert.match(account, /ChangeRequestForm/);
  assert.match(account, /shippingAddress/);
});

test("client account uses one responsive identity rail and one active-view heading", () => {
  assert.match(account, /lg:grid-cols-\[260px_minmax\(0,1fr\)\]/);
  assert.match(account, /<aside className=/);
  assert.match(account, /lg:sticky lg:top-6/);
  assert.match(account, /aria-current=\{view === key \? "page" : undefined\}/);
  assert.equal(account.match(/<h1\b/g)?.length, 1);
  assert.match(account, /const viewTitle = t\[view\]/);
  assert.match(account, /view === "overview"[\s\S]*PUBLIC_PATHS\.booking/);
  assert.match(account, /focus-visible:outline-accent/);
  assert.doesNotMatch(
    account,
    /<header className="flex flex-wrap items-end justify-between gap-5">/,
  );
});

test("saved addresses are client-owned, limited, defaulted, and exported by the schema", () => {
  assert.match(schema, /model SavedAddress/);
  assert.match(schema, /savedAddresses\s+SavedAddress\[\]/);
  assert.match(actions, />= 10/);
  assert.match(actions, /isDefault: false/);
  assert.match(actions, /lastUsedAt: "desc"/);
});

test("saved addresses have no customer-facing label field", () => {
  assert.doesNotMatch(account, /address\.label/);
  assert.doesNotMatch(account, /name="label"/);
  assert.doesNotMatch(checkoutForm, /address\.label/);
  assert.match(actions, /const label = line1\.slice\(0, 60\)/);
});

test("authenticated booking and checkout use the exact linked client", () => {
  assert.match(bookingPage, /currentUser/);
  assert.match(bookingPage, /initialDetails/);
  assert.match(checkout, /accountClient\?\.fullName/);
  assert.match(checkout, /savedAddressId/);
  assert.match(checkout, /shippingAddress: selectedAddress/);
  assert.match(checkout, /customer_update/);
});

test("external integration attempts are redacted, retained, and admin visible", () => {
  assert.match(schema, /model ExternalApiAttempt/);
  assert.match(logging, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(logging, /authorization\|token\|secret/);
  assert.match(logging, /external_api_log_failure/);
  assert.match(adminLogs, /prisma\.externalApiAttempt\.findMany/);
});
