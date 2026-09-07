import type { Locale } from "@/i18n/routing";

export const ADMIN_SEGMENTS = {
  dashboard: "",
  login: "kirjaudu",
  clients: "asiakkaat",
  staff: "henkilosto",
  settings: "omat-asetukset",
  audit: "lokit",
  integrations: "integraatiolokit",
  calendar: "kalenteri",
  appointments: "ajanvaraukset",
  orders: "tilaukset",
  services: "palvelut",
  technologies: "teknologiat",
  content: "sisalto",
  products: "tuotteet",
  pricing: "hinnasto",
  blog: "artikkelit",
  chat: "keskustelut",
} as const;

export type AdminModule = keyof typeof ADMIN_SEGMENTS;

export const LEGACY_ADMIN_SEGMENTS: Record<string, string> = {
  login: ADMIN_SEGMENTS.login,
  clients: ADMIN_SEGMENTS.clients,
  staff: ADMIN_SEGMENTS.staff,
  settings: ADMIN_SEGMENTS.settings,
  audit: ADMIN_SEGMENTS.audit,
  integrations: ADMIN_SEGMENTS.integrations,
  calendar: ADMIN_SEGMENTS.calendar,
  appointments: ADMIN_SEGMENTS.appointments,
  orders: ADMIN_SEGMENTS.orders,
  services: ADMIN_SEGMENTS.services,
  technologies: ADMIN_SEGMENTS.technologies,
  content: ADMIN_SEGMENTS.content,
  products: ADMIN_SEGMENTS.products,
  pricing: ADMIN_SEGMENTS.pricing,
  blog: ADMIN_SEGMENTS.blog,
  chat: ADMIN_SEGMENTS.chat,
  new: "uusi",
};

export function adminBase(locale: Locale): string {
  return locale === "fi" ? "/admin" : `/${locale}/admin`;
}

export function isUnprefixedAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function adminHref(
  locale: Locale,
  module: AdminModule,
  suffix?: string,
): string {
  const segment = ADMIN_SEGMENTS[module];
  return [adminBase(locale), segment, suffix]
    .filter(Boolean)
    .join("/")
    .replaceAll("//", "/");
}

export function adminRecordId(
  module: AdminModule,
  segments: string[],
): string | undefined {
  if (module === "content") return segments.join("/") || undefined;
  return segments[0];
}

export function localeFromAdminPath(pathname: string): Locale {
  if (pathname.startsWith("/en/")) return "en";
  if (pathname.startsWith("/ru/")) return "ru";
  return "fi";
}
