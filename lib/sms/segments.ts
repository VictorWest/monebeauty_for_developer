const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split(
    "",
  ),
);
const GSM_EXTENDED = new Set("^{}\\[~]|€".split(""));

export function normalizeSmsText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function smsSegments(text: string) {
  const normalized = normalizeSmsText(text);
  let units = 0;
  let encoding: "GSM-7" | "UCS-2" = "GSM-7";
  for (const character of normalized) {
    if (GSM_BASIC.has(character)) units += 1;
    else if (GSM_EXTENDED.has(character)) units += 2;
    else {
      encoding = "UCS-2";
      break;
    }
  }
  if (encoding === "UCS-2") units = [...normalized].length;
  const single = encoding === "GSM-7" ? 160 : 70;
  const concatenated = encoding === "GSM-7" ? 153 : 67;
  return {
    text: normalized,
    encoding,
    units,
    segments:
      units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / concatenated),
  };
}
