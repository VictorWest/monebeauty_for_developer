import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fi", "en", "ru"],
  defaultLocale: "fi",
  // Finnish mirrors the live site with no prefix; English and Russian stay prefixed.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
