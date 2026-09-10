import { BRAND, CONTACT } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import { orderPath, PUBLIC_PATHS } from "@/lib/public-routes";
import { absoluteLocalizedUrl, siteUrl } from "@/lib/seo";
import type { AppointmentEmailData, OrderEmailData } from "./messages";
import {
  appointmentCalendarToken,
  appointmentIcs,
  googleCalendarUrl,
} from "@/lib/appointment-calendar";
import { orderAccessToken } from "@/lib/order-access";
import {
  CANCELLATION_POLICY,
  CANCELLATION_POLICY_ANCHOR,
  cancellationPolicyText,
} from "@/content/cancellation-policy";
import {
  appointmentManageUrl,
  emailReference,
  formatEmailDateTime,
  formatEmailMoney,
  EMAIL_COPY,
} from "./messages";
import {
  escapeHtml,
  plainTextFooter,
  renderCta,
  renderDetailsTable,
  renderEmailShell,
  renderNotice,
  renderOrderItemsTable,
  type EmailMessage,
} from "./template";

const COPY = {
  fi: {
    greeting: (name: string) => `Hei ${name},`,
    appointment: {
      confirmation: [
        "Ajanvaraus vahvistettu",
        "Ajanvarauksesi on vahvistettu.",
      ],
      details: [
        "Ajanvarauksesi tiedot",
        "Tässä ovat tulevan ajanvarauksesi tiedot.",
      ],
      rescheduled: [
        "Uusi aika vahvistettu",
        "Uusi ajanvarausaikasi on vahvistettu.",
      ],
      cancellation: ["Ajanvaraus peruttu", "Ajanvarauksesi on peruttu."],
    },
    order: {
      confirmation: ["Tilaus vahvistettu", "Tilauksesi on vahvistettu."],
      cancellation: ["Tilaus peruttu", "Tilauksesi on peruttu."],
    },
    labels: {
      reference: "Viite",
      service: "Palvelu",
      time: "Aika",
      reason: "Syy",
      item: "Tuote",
      unit: "Kappalehinta",
      total: "Yhteensä",
      orderTotal: "Kokonaissumma",
    },
    notice:
      "Maksua ei ole veloitettu verkkosivustolla. Klinikka ottaa yhteyttä, jos jatkotoimia tarvitaan.",
    view: "Näytä tiedot",
    questions: "Kysyttävää?",
  },
  en: {
    greeting: (name: string) => `Hello ${name},`,
    appointment: {
      confirmation: [
        "Appointment confirmed",
        "Your appointment has been confirmed.",
      ],
      details: [
        "Your appointment details",
        "Here are the details of your upcoming appointment.",
      ],
      rescheduled: [
        "New time confirmed",
        "Your new appointment time is confirmed.",
      ],
      cancellation: [
        "Appointment cancelled",
        "Your appointment has been cancelled.",
      ],
    },
    order: {
      confirmation: ["Order confirmed", "Your order has been confirmed."],
      cancellation: ["Order cancelled", "Your order has been cancelled."],
    },
    labels: {
      reference: "Reference",
      service: "Service",
      time: "Time",
      reason: "Reason",
      item: "Item",
      unit: "Unit price",
      total: "Total",
      orderTotal: "Order total",
    },
    notice:
      "No payment has been captured through the website. The clinic will contact you if any next steps are needed.",
    view: "View details",
    questions: "Questions?",
  },
  ru: {
    greeting: (name: string) => `Здравствуйте, ${name}!`,
    appointment: {
      confirmation: ["Запись подтверждена", "Ваша запись подтверждена."],
      details: [
        "Детали вашей записи",
        "Ниже: детали вашего предстоящего визита.",
      ],
      rescheduled: [
        "Новое время подтверждено",
        "Новое время вашей записи подтверждено.",
      ],
      cancellation: ["Запись отменена", "Ваша запись отменена."],
    },
    order: {
      confirmation: ["Заказ подтверждён", "Ваш заказ подтверждён."],
      cancellation: ["Заказ отменён", "Ваш заказ отменён."],
    },
    labels: {
      reference: "Номер",
      service: "Услуга",
      time: "Время",
      reason: "Причина",
      item: "Товар",
      unit: "Цена",
      total: "Сумма",
      orderTotal: "Итого",
    },
    notice:
      "Оплата через сайт не списывалась. Клиника свяжется с вами, если потребуются дальнейшие действия.",
    view: "Открыть детали",
    questions: "Есть вопросы?",
  },
} satisfies Record<Locale, unknown>;

const BOOKING_COPY = {
  en: {
    duration: "Duration",
    specialist: "Specialist",
    payment: "Payment",
    payAtClinic: "Pay at the clinic",
    address: "Address",
    email: "Email",
    manageTitle: "Need to cancel or reschedule?",
    manageText:
      "Reschedule or cancel your appointment yourself using the secure link below: no account needed.",
    manage: "Cancel or reschedule",
    google: "Google Calendar",
    apple: "Apple Calendar",
    outlook: "Outlook",
    other: "Other calendar",
    maps: "Google Maps",
    appleMaps: "Apple Maps",
    minutes: "min",
  },
  fi: {
    duration: "Kesto",
    specialist: "Asiantuntija",
    payment: "Maksu",
    payAtClinic: "Maksetaan klinikalla",
    address: "Osoite",
    email: "Sähköposti",
    manageTitle: "Haluatko peruuttaa tai siirtää aikaasi?",
    manageText:
      "Voit siirtää tai peruuttaa aikasi itse alla olevasta turvallisesta linkistä: tiliä ei tarvita.",
    manage: "Peruuta tai siirrä",
    google: "Google-kalenteri",
    apple: "Apple-kalenteri",
    outlook: "Outlook-kalenteri",
    other: "Muu kalenteri",
    maps: "Google Maps",
    appleMaps: "Apple Maps",
    minutes: "min",
  },
  ru: {
    duration: "Длительность",
    specialist: "Специалист",
    payment: "Оплата",
    payAtClinic: "Оплата в клинике",
    address: "Адрес",
    email: "Email",
    manageTitle: "Нужно отменить или перенести запись?",
    manageText:
      "Вы можете перенести или отменить визит сами по защищённой ссылке ниже: аккаунт не нужен.",
    manage: "Отменить или перенести",
    google: "Google Календарь",
    apple: "Apple Календарь",
    outlook: "Outlook",
    other: "Другой календарь",
    maps: "Google Maps",
    appleMaps: "Apple Maps",
    minutes: "мин",
  },
} as const;

function emailButton(label: string, href: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 7px 8px 0;padding:10px 14px;border:1px solid #B79A6B;border-radius:20px;color:#3A322B;text-decoration:none;font-size:12px;line-height:1.2;">${escapeHtml(label)}</a>`;
}

function url(path: string, locale: Locale) {
  return `${siteUrl()}${absoluteLocalizedUrl("", path, locale)}`;
}

function paragraph(text: string, muted = false) {
  return `<p style="margin:0 0 22px;color:${muted ? "#6B6056" : "#3A322B"};font-size:15px;line-height:1.7;">${escapeHtml(text)}</p>`;
}

function orderItems(order: OrderEmailData, locale: Locale) {
  return order.items.map((item) => ({
    name: item.name,
    quantity: item.qty,
    unitPrice: formatEmailMoney(item.unitPrice, order.currency, locale),
    lineTotal: formatEmailMoney(
      Number(item.unitPrice) * item.qty,
      order.currency,
      locale,
    ),
  }));
}

export function renderOrderLifecycleEmail(
  order: OrderEmailData,
  locale: Locale,
  kind: "confirmation" | "cancellation",
  reason?: string | null,
): EmailMessage {
  const copy = COPY[locale];
  const [heading, intro] = copy.order[kind];
  const reference = emailReference(order.id);
  const orderPage = `${url(orderPath(order.id), locale)}?token=${encodeURIComponent(orderAccessToken(order.id))}`;
  const items = orderItems(order, locale);
  const total = formatEmailMoney(order.total, order.currency, locale);
  const details = [
    { label: copy.labels.reference, value: reference },
    ...(reason ? [{ label: copy.labels.reason, value: reason }] : []),
  ];
  const body = [
    ...(order.client?.fullName
      ? [paragraph(copy.greeting(order.client.fullName))]
      : []),
    paragraph(intro, true),
    renderDetailsTable(details),
    '<div style="height:22px;line-height:22px;">&nbsp;</div>',
    renderOrderItemsTable({
      items,
      labels: {
        item: copy.labels.item,
        unitPrice: copy.labels.unit,
        total: copy.labels.total,
      },
    }),
    `<p style="margin:18px 0 0;color:#3A322B;font-size:17px;font-weight:600;line-height:1.4;text-align:right;">${escapeHtml(copy.labels.orderTotal)}: ${escapeHtml(total)}</p>`,
    ...(kind === "confirmation" ? [renderNotice(copy.notice)] : []),
    renderCta(copy.view, orderPage),
    paragraph(`${copy.questions} ${CONTACT.email} · ${CONTACT.phone}`, true),
  ].join("");
  const text = [
    ...(order.client?.fullName ? [copy.greeting(order.client.fullName)] : []),
    intro,
    ...details.map(({ label, value }) => `${label}: ${value}`),
    "",
    ...items.map(
      (item) => `${item.quantity} × ${item.name}: ${item.lineTotal}`,
    ),
    `${copy.labels.orderTotal}: ${total}`,
    ...(kind === "confirmation" ? ["", copy.notice] : []),
    "",
    `${copy.view}: ${orderPage}`,
    plainTextFooter(locale),
  ].join("\n");
  return {
    subject: `${BRAND.name}: ${heading} ${reference}`,
    text,
    html: renderEmailShell({ locale, preheader: intro, heading, body }),
  };
}

export function renderLegacyAppointmentLifecycleEmail(
  appointment: AppointmentEmailData,
  locale: Locale,
  kind: "confirmation" | "rescheduled" | "cancellation",
  reason?: string | null,
): EmailMessage {
  const copy = COPY[locale];
  const [heading, intro] = copy.appointment[kind];
  const reference = emailReference(appointment.id);
  const service =
    appointment.procedureTitle ??
    appointment.service.title ??
    appointment.service.slug;
  const details = [
    { label: copy.labels.service, value: service },
    {
      label: copy.labels.time,
      value: formatEmailDateTime(appointment.start, locale),
    },
    { label: copy.labels.reference, value: reference },
    ...(reason ? [{ label: copy.labels.reason, value: reason }] : []),
  ];
  const body = [
    paragraph(copy.greeting(appointment.client.fullName)),
    paragraph(intro, true),
    renderDetailsTable(details),
    renderCta(copy.view, url(PUBLIC_PATHS.booking, locale)),
    paragraph(`${copy.questions} ${CONTACT.email} · ${CONTACT.phone}`, true),
  ].join("");
  const text = [
    copy.greeting(appointment.client.fullName),
    intro,
    "",
    ...details.map(({ label, value }) => `${label}: ${value}`),
    "",
    `${copy.view}: ${url(PUBLIC_PATHS.booking, locale)}`,
    plainTextFooter(locale),
  ].join("\n");
  return {
    subject: `${BRAND.name}: ${heading} ${reference}`,
    text,
    html: renderEmailShell({ locale, preheader: intro, heading, body }),
  };
}

export function renderAppointmentLifecycleEmail(
  appointment: AppointmentEmailData,
  locale: Locale,
  kind: "confirmation" | "details" | "rescheduled" | "cancellation",
  reason?: string | null,
): EmailMessage {
  const copy = COPY[locale];
  const rich = BOOKING_COPY[locale];
  const [heading, intro] = copy.appointment[kind];
  const reference = emailReference(appointment.id);
  const service =
    appointment.procedureTitle ??
    appointment.service.title ??
    appointment.service.slug;
  const duration = Math.max(
    1,
    Math.round(
      (appointment.end.getTime() - appointment.start.getTime()) / 60000,
    ),
  );
  const details = [
    { label: copy.labels.service, value: service },
    {
      label: copy.labels.time,
      value: formatEmailDateTime(appointment.start, locale),
    },
    { label: rich.duration, value: `${duration} ${rich.minutes}` },
    ...(appointment.practitioner?.name
      ? [
          {
            label: rich.specialist,
            value:
              appointment.practitioner.publicName ??
              appointment.practitioner.name,
          },
        ]
      : []),
    {
      label: rich.payment,
      value: appointment.procedurePrice
        ? `${appointment.procedurePrice} · ${rich.payAtClinic}`
        : rich.payAtClinic,
    },
    { label: copy.labels.reference, value: reference },
    ...(reason ? [{ label: copy.labels.reason, value: reason }] : []),
  ];
  const manageUrl =
    appointment.manageUrl ?? appointmentManageUrl(appointment.id, locale);
  const calendarToken = appointmentCalendarToken(appointment.id);
  const calendarUrl = `${siteUrl()}/api/appointments/${appointment.id}/calendar?token=${encodeURIComponent(calendarToken)}`;
  const googleUrl = googleCalendarUrl({
    id: appointment.id,
    start: appointment.start,
    end: appointment.end,
    title: service,
    description: appointment.service.description,
  });
  const address = `${BRAND.name}, ${CONTACT.address.street}, ${CONTACT.address.postalCode} ${CONTACT.address.city}`;
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const appleMaps = `https://maps.apple.com/?q=${encodeURIComponent(BRAND.name)}&ll=${CONTACT.geo.lat},${CONTACT.geo.lng}`;
  const policy = CANCELLATION_POLICY[locale];
  const policyUrl = `${url(PUBLIC_PATHS.terms, locale)}#${CANCELLATION_POLICY_ANCHOR}`;
  const calendarButtons =
    kind === "cancellation"
      ? ""
      : `<div style="margin:14px 0 20px;">${emailButton(rich.google, googleUrl)}${emailButton(rich.apple, calendarUrl)}${emailButton(rich.outlook, calendarUrl)}${emailButton(rich.other, calendarUrl)}</div>`;
  const body = [
    paragraph(copy.greeting(appointment.client.fullName)),
    paragraph(intro, true),
    renderDetailsTable(details),
    ...(appointment.service.description
      ? [paragraph(appointment.service.description, true)]
      : []),
    calendarButtons,
    renderDetailsTable([
      { label: rich.address, value: address },
      { label: rich.email, value: CONTACT.email },
      { label: policy.title, value: cancellationPolicyText(locale) },
    ]),
    `<div style="margin:0 0 18px;">${emailButton(policy.linkLabel, policyUrl)}</div>`,
    kind === "cancellation"
      ? ""
      : `<div style="margin:22px 0;padding:20px;background:#F5EFE4;border:1px solid #E7DECF;text-align:center;"><p style="margin:0 0 8px;color:#3A322B;font-size:17px;font-weight:600;">${escapeHtml(rich.manageTitle)}</p><p style="margin:0 0 14px;color:#6B6056;font-size:13px;line-height:1.6;">${escapeHtml(rich.manageText)}</p>${renderCta(rich.manage, manageUrl)}</div>`,
    `<div style="margin:0 0 18px;">${emailButton(rich.maps, googleMaps)}${emailButton(rich.appleMaps, appleMaps)}</div>`,
    appointment.claimUrl && kind !== "cancellation"
      ? `<p style="margin:0 0 18px;color:#6B6056;font-size:13px;line-height:1.6;"><a href="${escapeHtml(appointment.claimUrl)}" style="color:#97785A;">${escapeHtml(EMAIL_COPY[locale].saveToAccount)}</a></p>`
      : "",
    paragraph(`${copy.questions} ${CONTACT.email} · ${CONTACT.phone}`, true),
  ].join("");
  const text = [
    copy.greeting(appointment.client.fullName),
    intro,
    "",
    ...details.map(({ label, value }) => `${label}: ${value}`),
    "",
    `${rich.address}: ${address}`,
    cancellationPolicyText(locale),
    `${policy.linkLabel}: ${policyUrl}`,
    ...(kind === "cancellation"
      ? []
      : [
          `${rich.manage}: ${manageUrl}`,
          `${rich.google}: ${googleUrl}`,
          `${rich.other}: ${calendarUrl}`,
        ]),
    "",
    plainTextFooter(locale),
  ].join("\n");
  const ics = appointmentIcs({
    id: appointment.id,
    start: appointment.start,
    end: appointment.end,
    title: service,
    description: appointment.service.description,
    status: kind === "cancellation" ? "CANCELLED" : "CONFIRMED",
  });
  return {
    subject: `${BRAND.name}: ${heading} ${reference}`,
    text,
    html: renderEmailShell({ locale, preheader: intro, heading, body }),
    attachments: [
      {
        filename: `mone-beauty-${reference}.ics`,
        content: Buffer.from(ics).toString("base64"),
        contentType: "text/calendar; charset=utf-8",
      },
    ],
  };
}

export function renderCustomEmail({
  locale,
  subject,
  bodyText,
  reference,
}: {
  locale: Locale;
  subject: string;
  bodyText: string;
  reference: string;
}): EmailMessage {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((value) => paragraph(value.replace(/\n/g, " ")))
    .join("");
  const text = `${bodyText}\n\n${COPY[locale].labels.reference}: ${reference}\n\n${plainTextFooter(locale)}`;
  return {
    subject,
    text,
    html: renderEmailShell({
      locale,
      preheader: bodyText.slice(0, 140),
      heading: subject,
      body: `${paragraphs}${renderDetailsTable([{ label: COPY[locale].labels.reference, value: reference }])}`,
    }),
  };
}
