import {
  INTERNAL_CALENDAR_SERVICES,
  INTERNAL_PALETTE_MAX_SELECTED,
} from "@/lib/internal-calendar-services";
import { clinicDateTimeToInstant, minuteLabel } from "@/lib/clinic-time";

export type InternalPaletteCatalogItem = {
  key: string;
  dragLabels: { fi: string; en: string; ru: string };
  defaultEnabled: boolean;
};

export type InternalPalettePreference = {
  key: string;
  aliases: { fi: string; en: string; ru: string };
  enabled: boolean;
};

export function truncateCalendarAlias(value: string) {
  return Array.from(value.trim()).slice(0, 14).join("");
}

function defaultCatalog(): InternalPaletteCatalogItem[] {
  return INTERNAL_CALENDAR_SERVICES.map((service) => ({
    key: service.key,
    dragLabels: service.dragLabels,
    defaultEnabled: service.defaultEnabled,
  }));
}

export function normalizeInternalPalette(
  value: unknown,
  catalog: InternalPaletteCatalogItem[] = defaultCatalog(),
) {
  const catalogByKey = new Map(catalog.map((item) => [item.key, item]));
  const seen = new Set<string>();
  const normalized: InternalPalettePreference[] = [];
  let enabledCount = 0;

  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Partial<InternalPalettePreference> & {
        alias?: unknown;
        aliases?: Partial<InternalPalettePreference["aliases"]>;
      };
      if (!item.key || !catalogByKey.has(item.key) || seen.has(item.key))
        continue;
      const fallback = catalogByKey.get(item.key)!;
      const requestedEnabled = item.enabled !== false;
      const enabled =
        requestedEnabled && enabledCount < INTERNAL_PALETTE_MAX_SELECTED;
      if (enabled) enabledCount += 1;
      seen.add(item.key);
      const legacyFinnishAlias = truncateCalendarAlias(
        String(item.alias ?? ""),
      );
      normalized.push({
        key: item.key,
        aliases: {
          fi:
            truncateCalendarAlias(String(item.aliases?.fi ?? "")) ||
            legacyFinnishAlias ||
            fallback.dragLabels.fi,
          en:
            truncateCalendarAlias(String(item.aliases?.en ?? "")) ||
            fallback.dragLabels.en,
          ru:
            truncateCalendarAlias(String(item.aliases?.ru ?? "")) ||
            fallback.dragLabels.ru,
        },
        enabled,
      });
    }
  }

  for (const item of catalog) {
    if (seen.has(item.key)) continue;
    const enabled =
      item.defaultEnabled && enabledCount < INTERNAL_PALETTE_MAX_SELECTED;
    if (enabled) enabledCount += 1;
    normalized.push({
      key: item.key,
      aliases: {
        fi: truncateCalendarAlias(item.dragLabels.fi),
        en: truncateCalendarAlias(item.dragLabels.en),
        ru: truncateCalendarAlias(item.dragLabels.ru),
      },
      enabled,
    });
  }
  return normalized;
}

export function normalizeEmployeeSelection(
  value: unknown,
  validIds: string[],
  ownPractitionerId: string | null,
) {
  const valid = new Set(validIds);
  const stored = Array.isArray(value)
    ? [...new Set(value.map(String).filter((id) => valid.has(id)))]
    : [];
  if (stored.length) return ownPractitionerId ? [ownPractitionerId] : stored;
  return ownPractitionerId ? [ownPractitionerId] : validIds;
}

export function calendarDropStart(date: string, minute: number): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute >= 1440 ||
    minute % 15 !== 0
  )
    return null;
  return (
    clinicDateTimeToInstant(date, minuteLabel(minute))?.toISOString() ?? null
  );
}
