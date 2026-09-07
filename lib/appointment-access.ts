import { createHmac, timingSafeEqual } from "node:crypto";

function secret() { return process.env.APPOINTMENT_ACCESS_SECRET?.trim() || process.env.DATABASE_URL || "monebeauty-local-manage-links"; }
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }

/** Domain separator so a leaked `.ics` calendar link cannot be replayed as a manage link. */
const SCOPE = "manage";

export function appointmentManageToken(id: string, expiresAt = Date.now() + 400 * 24 * 60 * 60 * 1000) {
  const payload = `${SCOPE}.${id}.${Math.floor(expiresAt / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

/** Reads the appointment id out of a manage token without trusting it. Verify with {@link validAppointmentManageToken}. */
export function appointmentIdFromManageToken(token: string): string | null {
  const [scope, id] = token.split(".");
  return scope === SCOPE && id ? id : null;
}

export function validAppointmentManageToken(id: string, token: string) {
  const [scope, tokenId, expiry, supplied] = token.split(".");
  if (scope !== SCOPE || tokenId !== id || !expiry || !supplied || Number(expiry) * 1000 < Date.now()) return false;
  const expected = Buffer.from(sign(`${scope}.${tokenId}.${expiry}`));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
