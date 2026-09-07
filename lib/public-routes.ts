export const PUBLIC_PATHS = {
  home: "/",
  clinic: "/klinikka",
  services: "/palvelut",
  technologies: "/laitehoidot",
  trichology: "/trikologia",
  arosha: "/arosha",
  shop: "/verkkokauppa",
  basket: "/ostoskori",
  checkout: "/kassa",
  order: "/tilaus",
  booking: "/ajanvaraus",
  manageAppointment: "/ajanvaraus/hallinta",
  pricing: "/hinnasto",
  articles: "/artikkelit",
  privacy: "/tietosuojaseloste",
  terms: "/kayttoehdot",
  cookies: "/evastekaytanto",
  staff: "/henkilosto",
  account: "/oma-tili",
} as const;

export const SERVICE_PUBLIC_PATHS = {
  facial: "/palvelut/kasvohoidot",
  body: "/palvelut/vartalohoidot",
  endospheres: "/palvelut/endospheres-terapia",
  laser: "/palvelut/laserkarvanpoisto",
  rf: "/palvelut/mikroneula-rf",
  trichology: "/palvelut/trikologia",
  brows: "/palvelut/kulmat-ja-ripset",
  packages: "/palvelut/hoitopaketit",
  giftCards: "/palvelut/lahjakortit",
  injectable: "/palvelut/injektiohoidot",
  consultation: "/palvelut/konsultaatio",
} as const;

/**
 * Body Treatments remains a navigation destination, but its landing is an
 * exact, synchronized mirror of the canonical Endospheres service page.
 */
export function serviceLandingContentPath(path: string) {
  return path === SERVICE_PUBLIC_PATHS.body
    ? SERVICE_PUBLIC_PATHS.endospheres
    : path;
}

export const TECHNOLOGY_PUBLIC_PATHS = {
  endospheres: "/laitehoidot/endospheres",
  laser: "/laitehoidot/laserkarvanpoisto",
  rf: "/laitehoidot/mikroneula-rf",
  trichology: PUBLIC_PATHS.trichology,
} as const;

export function productPath(slug: string) {
  return `${PUBLIC_PATHS.shop}/${slug}`;
}

export function articlePath(slug: string) {
  return `${PUBLIC_PATHS.articles}/${slug}`;
}

export function orderPath(id: string) {
  return `${PUBLIC_PATHS.order}/${id}`;
}

export function treatmentOptionPath(servicePath: string, optionKey: string) {
  return `${servicePath.replace(/\/$/u, "")}/${encodeURIComponent(optionKey)}`;
}

const LEGACY_EXACT_PATHS: Record<string, string> = {
  "/about": PUBLIC_PATHS.clinic,
  "/instrumental/endosphere": TECHNOLOGY_PUBLIC_PATHS.endospheres,
  "/instrumental/laser": TECHNOLOGY_PUBLIC_PATHS.laser,
  "/instrumental/mikroneulanrf": TECHNOLOGY_PUBLIC_PATHS.rf,
  "/trichology": PUBLIC_PATHS.trichology,
  "/services": PUBLIC_PATHS.services,
  "/services/face": SERVICE_PUBLIC_PATHS.facial,
  "/services/body": SERVICE_PUBLIC_PATHS.body,
  "/services/endospheres": SERVICE_PUBLIC_PATHS.endospheres,
  "/services/laser": SERVICE_PUBLIC_PATHS.laser,
  "/services/mikroneulanrf": SERVICE_PUBLIC_PATHS.rf,
  "/services/tricho": SERVICE_PUBLIC_PATHS.trichology,
  "/services/eyebrows": SERVICE_PUBLIC_PATHS.brows,
  "/services/packages": SERVICE_PUBLIC_PATHS.packages,
  "/services/gift-cards": SERVICE_PUBLIC_PATHS.giftCards,
  "/services/injectable": SERVICE_PUBLIC_PATHS.injectable,
  "/services/consultation": SERVICE_PUBLIC_PATHS.consultation,
  "/catalog": PUBLIC_PATHS.shop,
  "/basket": PUBLIC_PATHS.basket,
  "/checkout": PUBLIC_PATHS.checkout,
  "/order": PUBLIC_PATHS.order,
  "/booking": PUBLIC_PATHS.booking,
  "/pricing": PUBLIC_PATHS.pricing,
  "/blog": PUBLIC_PATHS.articles,
  "/privacy-policy": PUBLIC_PATHS.privacy,
  "/terms-of-use": PUBLIC_PATHS.terms,
  "/cookies-policy": PUBLIC_PATHS.cookies,
  "/staff": PUBLIC_PATHS.staff,
  "/account": PUBLIC_PATHS.account,
};

const LEGACY_PREFIX_PATHS: Array<[string, string]> = [
  ["/catalog/", `${PUBLIC_PATHS.shop}/`],
  ["/blog/", `${PUBLIC_PATHS.articles}/`],
  ["/order/", `${PUBLIC_PATHS.order}/`],
  ["/instrumental/", `${PUBLIC_PATHS.technologies}/`],
  ["/services/", `${PUBLIC_PATHS.services}/`],
];

function withoutTrailingSlash(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function canonicalizeLegacyPublicPath(pathname: string): string | null {
  const normalized = withoutTrailingSlash(pathname || "/");
  const localeMatch = normalized.match(/^\/(en|ru)(?=\/|$)/i);
  const localePrefix = localeMatch ? `/${localeMatch[1].toLowerCase()}` : "";
  const publicPath = localePrefix
    ? normalized.slice(localeMatch![0].length) || "/"
    : normalized;
  const exact = LEGACY_EXACT_PATHS[publicPath];
  if (exact) return `${localePrefix}${exact}`;
  for (const [legacy, canonical] of LEGACY_PREFIX_PATHS) {
    if (publicPath.startsWith(legacy)) {
      return `${localePrefix}${canonical}${publicPath.slice(legacy.length)}`;
    }
  }
  return null;
}

/** Converts scraped internal links to the canonical, locale-agnostic public path. */
export function canonicalInternalHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const match = href.match(/^([^?#]*)([?#].*)?$/);
  if (!match) return href;
  const pathname = match[1];
  const suffix = match[2] ?? "";
  const localeMatch = pathname.match(/^\/(?:en|ru)(?=\/|$)/i);
  const unprefixed = localeMatch
    ? pathname.slice(localeMatch[0].length) || "/"
    : pathname;
  const canonical =
    canonicalizeLegacyPublicPath(unprefixed) ??
    withoutTrailingSlash(unprefixed);
  return `${canonical}${suffix}`;
}

export function contentPagePath(slug: string) {
  if (slug === "home") return PUBLIC_PATHS.home;
  const path = slug.startsWith("/") ? slug : `/${slug}`;
  return canonicalizeLegacyPublicPath(path) ?? path;
}
