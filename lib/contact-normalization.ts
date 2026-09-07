import { normalizeInternationalPhone } from "@/lib/phone";

export function normalizeContactEmail(value: string | null | undefined) {
  const email = (value ?? "").trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeContactPhone(value: string | null | undefined) {
  return normalizeInternationalPhone(value ?? "");
}
