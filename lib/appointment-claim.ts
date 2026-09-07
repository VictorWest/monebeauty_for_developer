import { createAccountToken } from "@/lib/auth";
import { accountHref } from "@/lib/account-routing";
import { absoluteLocalizedUrl, siteUrl } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Issues a 7-day claim token and returns the localized link that binds a guest booking to a
 * client account. The link rides inside the localized appointment email rather than a separate
 * message of its own.
 */
export async function createAppointmentClaimUrl(
  { appointmentId, email }: { appointmentId: string; email: string },
  locale: Locale,
) {
  const token = await createAccountToken({
    email,
    purpose: "CLAIM_APPOINTMENT",
    appointmentId,
    ttlMs: CLAIM_TTL_MS,
  });
  const path = accountHref(locale, "claim").replace(/^\/(?:en|ru)(?=\/)/, "");
  return `${absoluteLocalizedUrl(siteUrl(), path, locale)}?token=${encodeURIComponent(token)}`;
}
