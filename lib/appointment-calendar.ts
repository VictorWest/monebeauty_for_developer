import { createHmac, timingSafeEqual } from "node:crypto";
import { BRAND, CONTACT } from "@/content/site";

type CalendarAppointment = {
  id: string;
  start: Date;
  end: Date;
  title: string;
  description?: string | null;
  status?: string;
};

function secret() {
  return process.env.APPOINTMENT_CALENDAR_SECRET?.trim() || process.env.DATABASE_URL || "monebeauty-local-calendar-links";
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function appointmentCalendarToken(id: string, expiresAt = Date.now() + 400 * 24 * 60 * 60 * 1000) {
  const payload = `${id}.${Math.floor(expiresAt / 1000)}`;
  return `${payload}.${signature(payload)}`;
}

export function validAppointmentCalendarToken(id: string, token: string) {
  const [tokenId, expiry, supplied] = token.split(".");
  if (tokenId !== id || !expiry || !supplied || Number(expiry) * 1000 < Date.now()) return false;
  const expected = signature(`${tokenId}.${expiry}`);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function icsDate(date: Date) { return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function icsText(value: string) { return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }

export function appointmentIcs(appointment: CalendarAppointment) {
  const location = `${CONTACT.address.street}, ${CONTACT.address.postalCode} ${CONTACT.address.city}, ${CONTACT.address.country}`;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${BRAND.name}//Appointments//EN`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${appointment.id}@${BRAND.domain}`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(appointment.start)}`, `DTEND:${icsDate(appointment.end)}`,
    `SUMMARY:${icsText(appointment.title)}`, `DESCRIPTION:${icsText(appointment.description ?? `${BRAND.name} appointment`)}`, `LOCATION:${icsText(location)}`,
    ...(appointment.status === "CANCELLED" ? ["STATUS:CANCELLED"] : ["STATUS:CONFIRMED"]),
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

export function googleCalendarUrl(appointment: CalendarAppointment) {
  const location = `${CONTACT.address.street}, ${CONTACT.address.postalCode} ${CONTACT.address.city}`;
  const query = new URLSearchParams({ action: "TEMPLATE", text: appointment.title, dates: `${icsDate(appointment.start)}/${icsDate(appointment.end)}`, details: appointment.description ?? BRAND.name, location });
  return `https://calendar.google.com/calendar/render?${query}`;
}
