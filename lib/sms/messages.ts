import { BRAND, CONTACT } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import { emailReference, formatEmailMoney } from "@/lib/email";
import { normalizeSmsText, smsSegments } from "./segments";

type AppointmentSmsData = {
  id: string;
  start: Date;
  client: { fullName: string };
  procedureTitle?: string | null;
};

type OrderSmsData = {
  id: string;
  total: unknown;
  currency: string;
};

function smsDate(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Helsinki",
  }).format(value);
}

function withBoundedReason(
  build: (reason: string) => string,
  reason?: string | null,
) {
  if (!reason) return normalizeSmsText(build(""));
  const characters = [...normalizeSmsText(reason)];
  while (characters.length) {
    const suffix =
      characters.length < [...normalizeSmsText(reason)].length ? "…" : "";
    const message = normalizeSmsText(build(`${characters.join("")}${suffix}`));
    if (smsSegments(message).segments <= 2) return message;
    characters.pop();
  }
  return normalizeSmsText(build(""));
}

const COPY = {
  fi: {
    appointment: {
      confirmed: "Ajanvaraus on vahvistettu",
      rescheduled: "Uusi aika on vahvistettu",
      cancelled: "Ajanvaraus on peruttu",
      reminder24: "Muistutus huomisesta ajasta",
      reminder2: "Muistutus pian alkavasta ajasta",
    },
    order: {
      confirmed: "Tilaus on vahvistettu",
      cancelled: "Tilaus on peruttu",
    },
    reason: "Syy",
    total: "Yhteensä",
    reference: "Viite",
  },
  en: {
    appointment: {
      confirmed: "Appointment confirmed",
      rescheduled: "New appointment time confirmed",
      cancelled: "Appointment cancelled",
      reminder24: "Reminder for tomorrow's appointment",
      reminder2: "Reminder for your appointment starting soon",
    },
    order: {
      confirmed: "Order confirmed",
      cancelled: "Order cancelled",
    },
    reason: "Reason",
    total: "Total",
    reference: "Ref",
  },
  ru: {
    appointment: {
      confirmed: "Запись подтверждена",
      rescheduled: "Новое время подтверждено",
      cancelled: "Запись отменена",
      reminder24: "Напоминание о записи на завтра",
      reminder2: "Ваша запись скоро начнётся",
    },
    order: {
      confirmed: "Заказ подтверждён",
      cancelled: "Заказ отменён",
    },
    reason: "Причина",
    total: "Итого",
    reference: "Номер",
  },
} satisfies Record<Locale, unknown>;

export function appointmentSms(
  appointment: AppointmentSmsData,
  locale: Locale,
  kind:
    | "confirmation"
    | "rescheduled"
    | "cancellation"
    | "reminder_24h"
    | "reminder_2h",
  service: string,
  reason?: string | null,
) {
  const copy = COPY[locale];
  const label =
    kind === "confirmation"
      ? copy.appointment.confirmed
      : kind === "rescheduled"
        ? copy.appointment.rescheduled
        : kind === "cancellation"
          ? copy.appointment.cancelled
          : kind === "reminder_24h"
            ? copy.appointment.reminder24
            : copy.appointment.reminder2;
  const treatment = appointment.procedureTitle ?? service;
  return withBoundedReason(
    (safeReason) =>
      `${BRAND.shortName}: ${label}. ${treatment}, ${smsDate(appointment.start, locale)}. ${copy.reference} ${emailReference(appointment.id)}.${safeReason ? ` ${copy.reason}: ${safeReason}.` : ""} ${CONTACT.phone}`,
    reason,
  );
}

export function orderSms(
  order: OrderSmsData,
  locale: Locale,
  kind: "confirmation" | "cancellation",
  reason?: string | null,
) {
  const copy = COPY[locale];
  const label =
    kind === "confirmation" ? copy.order.confirmed : copy.order.cancelled;
  return withBoundedReason(
    (safeReason) =>
      `${BRAND.shortName}: ${label}. ${copy.reference} ${emailReference(order.id)}. ${copy.total} ${formatEmailMoney(order.total, order.currency, locale)}.${safeReason ? ` ${copy.reason}: ${safeReason}.` : ""} ${CONTACT.phone}`,
    reason,
  );
}

export function staffAppointmentSms(
  appointment: AppointmentSmsData,
  service: string,
  kind: "new" | "rescheduled" | "cancelled" = "new",
) {
  const action =
    kind === "new"
      ? "Uusi ajanvarauspyyntö"
      : kind === "rescheduled"
        ? "Aika siirretty"
        : "Aika peruttu";
  return normalizeSmsText(
    `${BRAND.shortName}: ${action}. ${appointment.client.fullName}, ${appointment.procedureTitle ?? service}, ${smsDate(appointment.start, "fi")}, ${emailReference(appointment.id)}.`,
  );
}

export function staffOrderSms(order: OrderSmsData, customer: string) {
  return normalizeSmsText(
    `${BRAND.shortName}: Uusi maksettu verkkotilaus. ${customer}, ${formatEmailMoney(order.total, order.currency, "fi")}, ${emailReference(order.id)}.`,
  );
}
