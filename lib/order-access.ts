import { createHmac, timingSafeEqual } from "node:crypto";

function secret() { return process.env.ORDER_ACCESS_SECRET?.trim() || process.env.DATABASE_URL || "monebeauty-local-order-links"; }
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }

export function orderAccessToken(id: string, expiresAt = Date.now() + 400 * 24 * 60 * 60 * 1000) {
  const payload = `${id}.${Math.floor(expiresAt / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

export function validOrderAccessToken(id: string, token: string) {
  const [tokenId, expiry, supplied] = token.split(".");
  if (tokenId !== id || !expiry || !supplied || Number(expiry) * 1000 < Date.now()) return false;
  const expected = Buffer.from(sign(`${tokenId}.${expiry}`));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
