import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const english = (await import("../messages/en.json")).default;
  const localized = (await import(`../messages/${locale}.json`)).default;
  return {
    locale,
    messages: deepMerge(english, localized),
  };
});

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const previous = result[key];
    result[key] =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      previous &&
      typeof previous === "object" &&
      !Array.isArray(previous)
        ? deepMerge(
            previous as Record<string, unknown>,
            value as Record<string, unknown>,
          )
        : value;
  }
  return result;
}
