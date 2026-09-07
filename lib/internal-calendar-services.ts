import catalog from "@/content/generated/internal-calendar-services.json";

export type InternalCalendarService = {
  key: string;
  labelFi: string;
  labelEn: string;
  labelRu: string;
  dragLabel: string;
  dragLabels: { fi: string; en: string; ru: string };
  defaultDurationMin: number;
  color: string;
  defaultEnabled: boolean;
  displayOrder: number;
};

export const INTERNAL_CALENDAR_SERVICES =
  catalog satisfies InternalCalendarService[];

export const INTERNAL_CALENDAR_SERVICE_BY_KEY = new Map(
  INTERNAL_CALENDAR_SERVICES.map((service) => [service.key, service]),
);

export const INTERNAL_PALETTE_MAX_SELECTED = 24;
