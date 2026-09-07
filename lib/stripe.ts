import { createHash, randomBytes } from "node:crypto";
import Stripe from "stripe";

let client: Stripe | undefined;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function stripeClient() {
  if (!client) client = new Stripe(required("STRIPE_SECRET_KEY"));
  return client;
}

export function stripeWebhookSecret() {
  return required("STRIPE_WEBHOOK_SECRET");
}

export function stripeShippingRateId() {
  return required("STRIPE_FINLAND_SHIPPING_RATE_ID");
}

export function eurosToMinor(value: { toString(): string } | number | string) {
  const normalized = value.toString().trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("invalid_eur_amount");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("invalid_eur_amount");
  }
  return amount;
}

export function minorToEuros(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("invalid_minor_amount");
  }
  return (amount / 100).toFixed(2);
}

export function stripeObjectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

export function createCheckoutCancelToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: checkoutCancelTokenHash(token) };
}

export function checkoutCancelTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
