import type { Locale } from "@/i18n/routing";

const HANDOFF_PATTERNS: Record<Locale, RegExp[]> = {
  en: [
    /^(?:a\s+)?(?:human|real person|staff member|administrator)(?:\s+please)?[.!?]*$/i,
    /\b(?:speak|talk|chat)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|someone|staff|administrator)\b/i,
    /\b(?:call|contact|phone|message)\s+me\b/i,
    /\b(?:have|get|ask)\s+(?:a\s+)?(?:human|person|someone|staff)\s+(?:call|contact|reply|follow up)\b/i,
    /\b(?:human|person|someone|staff)\s+(?:can\s+)?(?:call|contact|reply|follow up)(?:\s+to)?\s+me\b/i,
  ],
  fi: [
    /\b(?:ihminen|henkilökunta|ylläpitäjä|asiakaspalvelija)\b/iu,
    /(?:haluan|voinko)\s+(?:puhua|keskustella)\s+(?:ihmisen|henkilön|henkilökunnan)\s+kanssa/iu,
    /(?:soita|soittakaa)\s+minulle/iu,
    /(?:ota|ottakaa)\s+(?:minuun\s+)?yhteyttä/iu,
  ],
  ru: [
    /(?:человек|сотрудник|администратор|оператор)/iu,
    /(?:хочу|можно)\s+(?:поговорить|связаться)\s+(?:с\s+)?(?:человеком|сотрудником|администратором|оператором)/iu,
    /(?:позвоните|перезвоните)\s+мне/iu,
    /свяжитесь\s+со\s+мной/iu,
  ],
};

export function detectHumanHandoffIntent(locale: Locale, message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return HANDOFF_PATTERNS[locale].some((pattern) => pattern.test(normalized));
}
