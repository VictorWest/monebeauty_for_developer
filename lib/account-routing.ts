import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/seo";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export const ACCOUNT_SEGMENTS = {
  login: "kirjaudu",
  register: "rekisteroidy",
  verify: "vahvista",
  forgot: "unohtunut-salasana",
  reset: "palauta-salasana",
  claim: "lunasta-varaus",
} as const;

export function accountHref(
  locale: Locale,
  segment?: keyof typeof ACCOUNT_SEGMENTS,
) {
  const suffix = segment ? `/${ACCOUNT_SEGMENTS[segment]}` : "";
  return localizedPath(`${PUBLIC_PATHS.account}${suffix}`, locale);
}

export function staffHref(locale: Locale, segment?: "login" | "password") {
  const suffix =
    segment === "login"
      ? "/kirjaudu"
      : segment === "password"
        ? "/vaihda-salasana"
        : "";
  return localizedPath(`${PUBLIC_PATHS.staff}${suffix}`, locale);
}
