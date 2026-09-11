/**
 * Client-safe booking config (no Prisma import), so both the server slot logic
 * (`lib/booking.ts`) and the client calendar (`components/booking/BookingCalendar.tsx`)
 * can share the clinic's bookable window. Tune to the clinic's real hours.
 */
export const BUSINESS_HOURS = {
  /** Open weekdays, 0=Sun … 6=Sat. Sunday closed by default. */
  openDays: [1, 2, 3, 4, 5, 6],
  startHour: 10,
  endHour: 19, // a slot must finish by this hour
  stepMin: 30,
  /** How many days ahead clients can book. */
  daysAhead: 60,
};

/**
 * Multi-procedure bookings (same specialist, back-to-back): a hard cap so
 * the combined-slot search stays cheap and the cart UI stays legible. Shared
 * by the server scheduling engine and the wizard's cart toggle.
 */
export const MAX_GROUP_PROCEDURES = 6;
