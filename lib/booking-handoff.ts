export const BOOKING_HANDOFF_KEY = "monebeauty.booking-handoff.v1";
export const BOOKING_HANDOFF_VERSION = 1;
export const BOOKING_HANDOFF_TTL_MS = 30 * 60 * 1000;

export type BookingHandoff = {
  version: typeof BOOKING_HANDOFF_VERSION;
  createdAt: number;
  expiresAt: number;
  service?: string;
  preferredDate?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type BookingHandoffInput = Omit<
  BookingHandoff,
  "version" | "createdAt" | "expiresAt"
>;

export function createBookingHandoff(
  input: BookingHandoffInput,
  now = Date.now(),
): BookingHandoff {
  return {
    version: BOOKING_HANDOFF_VERSION,
    createdAt: now,
    expiresAt: now + BOOKING_HANDOFF_TTL_MS,
    ...input,
  };
}

export function parseBookingHandoff(
  raw: string | null,
  now = Date.now(),
): BookingHandoff | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<BookingHandoff>;
    if (
      value.version !== BOOKING_HANDOFF_VERSION ||
      typeof value.createdAt !== "number" ||
      typeof value.expiresAt !== "number" ||
      value.createdAt > now ||
      value.expiresAt <= now ||
      value.expiresAt - value.createdAt !== BOOKING_HANDOFF_TTL_MS
    ) {
      return null;
    }
    return value as BookingHandoff;
  } catch {
    return null;
  }
}

export function isValidPreferredDate(value: unknown, now = new Date()) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed >= today
  );
}
