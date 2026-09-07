export function normalizeInternationalPhone(
  value: string,
  defaultCountryCode = "358",
) {
  const raw = value.trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  let phone = raw.replace(/[\s().-]+/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  else if (phone.startsWith("+"))
    phone = `+${phone.slice(1).replace(/\D/g, "")}`;
  else if (phone.startsWith("0"))
    phone = `+${defaultCountryCode}${phone.slice(1).replace(/\D/g, "")}`;
  else phone = `+${phone.replace(/\D/g, "")}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function normalizeCheckoutPhone(value: string) {
  const raw = value.trim();
  if (!/^\+[\d\s().-]+$/.test(raw)) return null;
  const phone = `+${raw.slice(1).replace(/[\s().-]+/g, "")}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
