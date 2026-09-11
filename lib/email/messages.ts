import { BRAND, CONTACT } from "@/content/site";
import { bookingServiceTitle } from "@/content/booking-services";
import type { Locale } from "@/i18n/routing";
import { absoluteLocalizedUrl, siteUrl } from "@/lib/seo";
import { PUBLIC_PATHS, orderPath } from "@/lib/public-routes";
import { orderAccessToken } from "@/lib/order-access";
import { appointmentManageToken } from "@/lib/appointment-access";
import {
  CANCELLATION_POLICY,
  CANCELLATION_POLICY_ANCHOR,
  cancellationPolicyText,
} from "@/content/cancellation-policy";
import {
  escapeHtml,
  plainTextFooter,
  renderCta,
  renderDetailsTable,
  renderEmailShell,
  renderNotice,
  renderOrderItemsTable,
  type EmailMessage,
  type EmailOrderItem,
} from "./template";

export type AppointmentEmailKind =
  "confirmation" | "reminder_24h" | "reminder_2h";

export type AppointmentEmailData = {
  id: string;
  start: Date;
  end: Date;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  client: { fullName: string; email: string; phone: string };
  service: {
    slug: string;
    title?: string;
    staffTitle?: string;
    description?: string;
  };
  practitioner?: { name: string; publicName?: string | null } | null;
  manageUrl?: string;
  /** Optional link binding a guest booking to a client account (see lib/appointment-claim.ts). */
  claimUrl?: string;
  procedureIndex?: number | null;
  procedureTitle?: string | null;
  procedurePrice?: string | null;
  /** Set only for a multi-procedure visit (several appointments sharing one
   * bookingGroupId): every procedure in the visit, in sequence order, each
   * keeping its own manage link so a client can still cancel/reschedule one
   * procedure independently of the rest. */
  groupProcedures?: Array<{
    title: string;
    price: string | null;
    durationMin: number;
    manageUrl: string;
  }>;
};

export type OrderEmailData = {
  id: string;
  email: string;
  phone: string | null;
  total: unknown;
  currency: string;
  client?: { fullName: string; email?: string; phone?: string } | null;
  fulfillmentMethod?: string | null;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: unknown;
    vouchers?: Array<{ code: string; expiresAt: Date }>;
  }>;
};

const PAID_ORDER_COPY = {
  fi: {
    subject: "maksuvahvistus",
    preheader: "Maksusi on vastaanotettu.",
    heading: "Kiitos tilauksestasi",
    intro: "Maksusi on vastaanotettu ja tilauksesi on vahvistettu.",
    notice:
      "Ajanvaraukset maksetaan edelleen klinikalla. Tämä vahvistus koskee vain verkkokaupan tilausta.",
    voucher: "Lahjakortti- tai hoitokoodi",
    pickup: "Nouto Mone Beauty Cliniciltä",
    shipping: "Toimitus Suomeen",
    digital: "Digitaalinen toimitus",
  },
  en: {
    subject: "payment confirmation",
    preheader: "Your payment has been received.",
    heading: "Thank you for your order",
    intro: "Your payment has been received and your order is confirmed.",
    notice:
      "Appointments are still paid at the clinic. This confirmation applies only to your online-store purchase.",
    voucher: "Gift card or treatment code",
    pickup: "Pickup from Mone Beauty Clinic",
    shipping: "Finland delivery",
    digital: "Digital delivery",
  },
  ru: {
    subject: "подтверждение оплаты",
    preheader: "Ваш платёж получен.",
    heading: "Спасибо за заказ",
    intro: "Ваш платёж получен, заказ подтверждён.",
    notice:
      "Записи на процедуры по-прежнему оплачиваются в клинике. Это подтверждение относится только к покупке в интернет-магазине.",
    voucher: "Код подарочной карты или процедуры",
    pickup: "Получение в Mone Beauty Clinic",
    shipping: "Доставка по Финляндии",
    digital: "Цифровая доставка",
  },
} satisfies Record<Locale, Record<string, string>>;

type Copy = {
  greeting: (name: string) => string;
  appointment: Record<
    AppointmentEmailKind,
    { subject: string; preheader: string; heading: string; intro: string }
  >;
  order: {
    subject: string;
    preheader: string;
    heading: string;
    intro: string;
    notice: string;
  };
  labels: {
    service: string;
    procedure: string;
    totalDuration: string;
    time: string;
    reference: string;
    item: string;
    unitPrice: string;
    lineTotal: string;
    total: string;
  };
  manageAppointment: string;
  saveToAccount: string;
  bookAnother: string;
  viewOrder: string;
  questions: string;
};

export const EMAIL_COPY: Record<Locale, Copy> = {
  fi: {
    greeting: (name) => `Hei ${name},`,
    appointment: {
      confirmation: {
        subject: "ajanvaraus vahvistettu",
        preheader: "Ajanvarauksesi on vahvistettu.",
        heading: "Ajanvaraus vahvistettu",
        intro:
          "Kiitos. Aikasi on varattu: odotamme sinua Mone Beauty Clinicille.",
      },
      reminder_24h: {
        subject: "muistutus huomisesta ajasta",
        preheader: "Muistutus: aikasi on huomenna.",
        heading: "Muistutus huomisesta ajasta",
        intro: "Tämä on muistutus: aikasi Mone Beauty Clinicillä on huomenna.",
      },
      reminder_2h: {
        subject: "ajanvarausmuistutus",
        preheader: "Muistutus: aikasi alkaa pian.",
        heading: "Ajanvarausmuistutus",
        intro: "Tämä on muistutus: aikasi Mone Beauty Clinicillä alkaa pian.",
      },
    },
    order: {
      subject: "tilauspyyntö",
      preheader: "Tilauspyyntösi on vastaanotettu.",
      heading: "Tilauspyyntö vastaanotettu",
      intro: "Kiitos. Olemme vastaanottaneet tilauspyyntösi.",
      notice:
        "Tämä ei ole vielä tilausvahvistus, eikä maksua ole veloitettu. Klinikka ottaa tarvittaessa yhteyttä jatkosta.",
    },
    labels: {
      service: "Palvelu",
      procedure: "Toimenpide",
      totalDuration: "Kokonaiskesto",
      time: "Aika",
      reference: "Viite",
      item: "Tuote",
      unitPrice: "Kappalehinta",
      lineTotal: "Yhteensä",
      total: "Kokonaissumma",
    },
    manageAppointment: "Hallinnoi ajanvarausta",
    saveToAccount: "Tallenna tämä aika omalle tilillesi",
    bookAnother: "Varaa toinen aika",
    viewOrder: "Näytä tilauspyyntö",
    questions: "Kysyttävää?",
  },
  en: {
    greeting: (name) => `Hello ${name},`,
    appointment: {
      confirmation: {
        subject: "appointment confirmed",
        preheader: "Your appointment is confirmed.",
        heading: "Your appointment is confirmed",
        intro:
          "Thank you. Your appointment is booked: we look forward to seeing you at Mone Beauty Clinic.",
      },
      reminder_24h: {
        subject: "appointment reminder for tomorrow",
        preheader: "Reminder: your appointment is tomorrow.",
        heading: "Your appointment is tomorrow",
        intro:
          "This is a reminder that your appointment at Mone Beauty Clinic is tomorrow.",
      },
      reminder_2h: {
        subject: "appointment reminder",
        preheader: "Reminder: your appointment starts soon.",
        heading: "Your appointment starts soon",
        intro:
          "This is a reminder that your appointment at Mone Beauty Clinic starts soon.",
      },
    },
    order: {
      subject: "order request",
      preheader: "Your order request has been received.",
      heading: "Order request received",
      intro: "Thank you. We have received your order request.",
      notice:
        "This is not yet an order confirmation and no payment has been captured. The clinic will contact you if any next steps are needed.",
    },
    labels: {
      service: "Service",
      procedure: "Procedure",
      totalDuration: "Total duration",
      time: "Time",
      reference: "Reference",
      item: "Item",
      unitPrice: "Unit price",
      lineTotal: "Total",
      total: "Order total",
    },
    manageAppointment: "Manage appointment",
    saveToAccount: "Save this appointment to a client account",
    bookAnother: "Book another appointment",
    viewOrder: "View order request",
    questions: "Questions?",
  },
  ru: {
    greeting: (name) => `Здравствуйте, ${name}!`,
    appointment: {
      confirmation: {
        subject: "запись подтверждена",
        preheader: "Ваша запись подтверждена.",
        heading: "Ваша запись подтверждена",
        intro:
          "Спасибо. Ваша запись оформлена: ждём вас в Mone Beauty Clinic.",
      },
      reminder_24h: {
        subject: "напоминание о завтрашнем визите",
        preheader: "Напоминание: ваш визит состоится завтра.",
        heading: "Ваш визит состоится завтра",
        intro:
          "Напоминаем, что ваш визит в Mone Beauty Clinic состоится завтра.",
      },
      reminder_2h: {
        subject: "напоминание о визите",
        preheader: "Напоминание: ваш визит скоро начнётся.",
        heading: "Ваш визит скоро начнётся",
        intro: "Напоминаем, что ваш визит в Mone Beauty Clinic скоро начнётся.",
      },
    },
    order: {
      subject: "запрос на заказ",
      preheader: "Ваш запрос на заказ получен.",
      heading: "Запрос на заказ получен",
      intro: "Спасибо. Мы получили ваш запрос на заказ.",
      notice:
        "Это ещё не подтверждение заказа; оплата не списана. При необходимости клиника свяжется с вами для уточнения дальнейших действий.",
    },
    labels: {
      service: "Услуга",
      procedure: "Процедура",
      totalDuration: "Общая продолжительность",
      time: "Время",
      reference: "Номер",
      item: "Товар",
      unitPrice: "Цена за единицу",
      lineTotal: "Сумма",
      total: "Итого",
    },
    manageAppointment: "Управлять записью",
    saveToAccount: "Сохранить эту запись в личном кабинете",
    bookAnother: "Записаться ещё раз",
    viewOrder: "Открыть запрос на заказ",
    questions: "Есть вопросы?",
  },
};

const LOCALE_TAG: Record<Locale, string> = {
  fi: "fi-FI",
  en: "en-GB",
  ru: "ru-RU",
};

export function emailReference(id: string): string {
  return id.slice(-8).toUpperCase();
}

export function formatEmailDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Helsinki",
  }).format(date);
}

export function formatEmailMoney(
  value: unknown,
  currency: string,
  locale: Locale,
): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], {
    style: "currency",
    currency,
  }).format(Number(value));
}

function localizedUrl(path: string, locale: Locale): string {
  return `${siteUrl()}${absoluteLocalizedUrl("", path, locale)}`;
}

/** Login-free, signed link letting the client reschedule or cancel this appointment. */
export function appointmentManageUrl(id: string, locale: Locale): string {
  const token = appointmentManageToken(id);
  return `${localizedUrl(PUBLIC_PATHS.manageAppointment, locale)}?token=${encodeURIComponent(token)}`;
}

function paragraph(value: string, muted = false): string {
  return `<p style="margin:0 0 22px;color:${muted ? "#6B6056" : "#3A322B"};font-size:15px;line-height:1.7;">${escapeHtml(value)}</p>`;
}

function serviceName(appointment: AppointmentEmailData, locale: Locale) {
  return (
    appointment.service.title ??
    bookingServiceTitle(appointment.service.slug, locale) ??
    appointment.service.slug
  );
}

function procedureName(appointment: AppointmentEmailData) {
  return [appointment.procedureTitle, appointment.procedurePrice]
    .filter(Boolean)
    .join(" · ");
}

export function renderCustomerAppointmentEmail(
  appointment: AppointmentEmailData,
  locale: Locale,
  kind: AppointmentEmailKind,
): EmailMessage {
  const copy = EMAIL_COPY[locale];
  const messageCopy = copy.appointment[kind];
  const reference = emailReference(appointment.id);
  const group =
    appointment.groupProcedures && appointment.groupProcedures.length > 1
      ? appointment.groupProcedures
      : null;
  const details = [
    { label: copy.labels.service, value: serviceName(appointment, locale) },
    ...(group
      ? [
          ...group.map((procedure, index) => ({
            label: `${copy.labels.procedure} ${index + 1}/${group.length}`,
            value: procedure.price
              ? `${procedure.title} · ${procedure.price}`
              : procedure.title,
          })),
          {
            label: copy.labels.totalDuration,
            value: `${group.reduce((sum, procedure) => sum + procedure.durationMin, 0)} min`,
          },
        ]
      : appointment.procedureTitle
        ? [{ label: copy.labels.procedure, value: procedureName(appointment) }]
        : []),
    {
      label: copy.labels.time,
      value: formatEmailDateTime(appointment.start, locale),
    },
    { label: copy.labels.reference, value: reference },
  ];
  const manageUrl =
    appointment.manageUrl ?? appointmentManageUrl(appointment.id, locale);
  const bookingUrl = localizedUrl(PUBLIC_PATHS.booking, locale);
  const policy = CANCELLATION_POLICY[locale];
  const policyUrl = `${localizedUrl(PUBLIC_PATHS.terms, locale)}#${CANCELLATION_POLICY_ANCHOR}`;
  const secondaryLinks = [
    [policy.linkLabel, policyUrl] as const,
    ...(kind === "confirmation"
      ? [
          ...(appointment.claimUrl
            ? [[copy.saveToAccount, appointment.claimUrl] as const]
            : []),
          [copy.bookAnother, bookingUrl] as const,
        ]
      : []),
    // Each procedure keeps its own independent manage/cancel link — the
    // primary CTA above only points at this (the first) appointment.
    ...(group
      ? group.map(
          (procedure, index) =>
            [
              `${copy.labels.procedure} ${index + 1}/${group.length}: ${procedure.title}`,
              procedure.manageUrl,
            ] as const,
        )
      : []),
  ];
  const secondaryLinksHtml = secondaryLinks
    .map(
      ([label, href]) =>
        `<p style="margin:14px 0 0;color:#6B6056;font-size:13px;line-height:1.6;"><a href="${escapeHtml(href)}" style="color:#97785A;">${escapeHtml(label)}</a></p>`,
    )
    .join("");
  const body = [
    paragraph(copy.greeting(appointment.client.fullName)),
    paragraph(messageCopy.intro, true),
    renderDetailsTable(details),
    renderNotice(cancellationPolicyText(locale)),
    renderCta(copy.manageAppointment, manageUrl),
    secondaryLinksHtml,
  ].join("");
  const text = [
    copy.greeting(appointment.client.fullName),
    messageCopy.intro,
    "",
    ...details.map(({ label, value }) => `${label}: ${value}`),
    "",
    cancellationPolicyText(locale),
    "",
    `${copy.manageAppointment}: ${manageUrl}`,
    ...secondaryLinks.map(([label, href]) => `${label}: ${href}`),
    "",
    plainTextFooter(locale),
  ].join("\n");

  return {
    subject: `${BRAND.name}: ${messageCopy.subject} ${reference}`,
    text,
    html: renderEmailShell({
      locale,
      preheader: messageCopy.preheader,
      heading: messageCopy.heading,
      body,
    }),
  };
}

function orderItems(order: OrderEmailData, locale: Locale): EmailOrderItem[] {
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

export function renderCustomerOrderEmail(
  order: OrderEmailData,
  locale: Locale,
): EmailMessage {
  const copy = EMAIL_COPY[locale];
  const paidCopy = PAID_ORDER_COPY[locale];
  const reference = emailReference(order.id);
  const items = orderItems(order, locale);
  const total = formatEmailMoney(order.total, order.currency, locale);
  const orderPage = `${localizedUrl(orderPath(order.id), locale)}?token=${encodeURIComponent(orderAccessToken(order.id))}`;
  const greeting = order.client?.fullName
    ? paragraph(copy.greeting(order.client.fullName))
    : "";
  const fulfillment =
    order.fulfillmentMethod === "PICKUP"
      ? paidCopy.pickup
      : order.fulfillmentMethod === "SHIPPING"
        ? paidCopy.shipping
        : paidCopy.digital;
  const vouchers = order.items.flatMap((item) => item.vouchers ?? []);
  const body = [
    greeting,
    paragraph(paidCopy.intro, true),
    renderDetailsTable([
      { label: copy.labels.reference, value: reference },
      { label: "", value: fulfillment },
    ]),
    '<div style="height:22px;line-height:22px;">&nbsp;</div>',
    renderOrderItemsTable({
      items,
      labels: {
        item: copy.labels.item,
        unitPrice: copy.labels.unitPrice,
        total: copy.labels.lineTotal,
      },
    }),
    `<p style="margin:18px 0 0;color:#3A322B;font-size:17px;font-weight:600;line-height:1.4;text-align:right;">${escapeHtml(copy.labels.total)}: ${escapeHtml(total)}</p>`,
    ...vouchers.map((voucher) =>
      renderNotice(`${paidCopy.voucher}: ${voucher.code}`),
    ),
    renderNotice(paidCopy.notice),
    renderCta(copy.viewOrder, orderPage),
    paragraph(`${copy.questions} ${CONTACT.email} · ${CONTACT.phone}`, true),
  ].join("");
  const itemLines = items.map(
    (item) =>
      `${item.quantity} × ${item.name}: ${item.unitPrice}: ${item.lineTotal}`,
  );
  const text = [
    ...(order.client?.fullName ? [copy.greeting(order.client.fullName)] : []),
    paidCopy.intro,
    `${copy.labels.reference}: ${reference}`,
    fulfillment,
    "",
    ...itemLines,
    `${copy.labels.total}: ${total}`,
    "",
    ...vouchers.map((voucher) => `${paidCopy.voucher}: ${voucher.code}`),
    paidCopy.notice,
    `${copy.viewOrder}: ${orderPage}`,
    `${copy.questions} ${CONTACT.email} / ${CONTACT.phone}`,
    "",
    plainTextFooter(locale),
  ].join("\n");

  return {
    subject: `${BRAND.name}: ${paidCopy.subject} ${reference}`,
    text,
    html: renderEmailShell({
      locale,
      preheader: paidCopy.preheader,
      heading: paidCopy.heading,
      body,
    }),
  };
}

const STAFF_COPY = {
  newBooking: "Uusi ajanvaraus",
  newOrder: "Uusi maksettu verkkotilaus",
  bookingIntro: "Uusi ajanvarauspyyntö on vastaanotettu verkkosivustolta.",
  orderIntro: "Uusi maksettu tilaus on vastaanotettu verkkosivustolta.",
  customer: "Asiakas",
  phone: "Puhelin",
  email: "Sähköposti",
} as const;

export function renderStaffAppointmentEmail(
  appointment: AppointmentEmailData,
): EmailMessage {
  const locale: Locale = "fi";
  const copy = EMAIL_COPY.fi;
  const reference = emailReference(appointment.id);
  const group =
    appointment.groupProcedures && appointment.groupProcedures.length > 1
      ? appointment.groupProcedures
      : null;
  const details = [
    { label: STAFF_COPY.customer, value: appointment.client.fullName },
    { label: STAFF_COPY.phone, value: appointment.client.phone },
    { label: STAFF_COPY.email, value: appointment.client.email },
    {
      label: copy.labels.service,
      value:
        appointment.service.staffTitle ??
        bookingServiceTitle(appointment.service.slug, locale) ??
        appointment.service.slug,
    },
    ...(group
      ? [
          ...group.map((procedure, index) => ({
            label: `${copy.labels.procedure} ${index + 1}/${group.length}`,
            value: procedure.price
              ? `${procedure.title} · ${procedure.price}`
              : procedure.title,
          })),
          {
            label: copy.labels.totalDuration,
            value: `${group.reduce((sum, procedure) => sum + procedure.durationMin, 0)} min`,
          },
        ]
      : appointment.procedureTitle
        ? [{ label: copy.labels.procedure, value: procedureName(appointment) }]
        : []),
    {
      label: copy.labels.time,
      value: formatEmailDateTime(appointment.start, locale),
    },
    { label: copy.labels.reference, value: reference },
  ];
  const text = [
    STAFF_COPY.bookingIntro,
    "",
    ...details.map(({ label, value }) => `${label}: ${value}`),
    "",
    plainTextFooter(locale),
  ].join("\n");
  return {
    subject: `${STAFF_COPY.newBooking}: ${reference}`,
    text,
    html: renderEmailShell({
      locale,
      preheader: `${STAFF_COPY.newBooking}: ${reference}`,
      heading: STAFF_COPY.newBooking,
      body: `${paragraph(STAFF_COPY.bookingIntro, true)}${renderDetailsTable(details)}`,
    }),
  };
}

export function renderStaffOrderEmail(order: OrderEmailData): EmailMessage {
  const locale: Locale = "fi";
  const copy = EMAIL_COPY.fi;
  const reference = emailReference(order.id);
  const items = orderItems(order, locale);
  const total = formatEmailMoney(order.total, order.currency, locale);
  const customerName = order.client?.fullName ?? "-";
  const details = [
    { label: STAFF_COPY.customer, value: customerName },
    { label: STAFF_COPY.phone, value: order.phone ?? "-" },
    { label: STAFF_COPY.email, value: order.email },
    { label: copy.labels.reference, value: reference },
  ];
  const body = [
    paragraph(STAFF_COPY.orderIntro, true),
    renderDetailsTable(details),
    '<div style="height:22px;line-height:22px;">&nbsp;</div>',
    renderOrderItemsTable({
      items,
      labels: {
        item: copy.labels.item,
        unitPrice: copy.labels.unitPrice,
        total: copy.labels.lineTotal,
      },
    }),
    `<p style="margin:18px 0 0;color:#3A322B;font-size:17px;font-weight:600;line-height:1.4;text-align:right;">${escapeHtml(copy.labels.total)}: ${escapeHtml(total)}</p>`,
  ].join("");
  const text = [
    STAFF_COPY.orderIntro,
    "",
    ...details.map(({ label, value }) => `${label}: ${value}`),
    "",
    ...items.map(
      (item) =>
        `${item.quantity} × ${item.name}: ${item.unitPrice}: ${item.lineTotal}`,
    ),
    `${copy.labels.total}: ${total}`,
    "",
    plainTextFooter(locale),
  ].join("\n");

  return {
    subject: `${STAFF_COPY.newOrder}: ${reference}`,
    text,
    html: renderEmailShell({
      locale,
      preheader: `${STAFF_COPY.newOrder}: ${reference}`,
      heading: STAFF_COPY.newOrder,
      body,
    }),
  };
}

export function renderDeliveryTestEmail(sentAt: Date): EmailMessage {
  const locale: Locale = "fi";
  const heading = "Sähköpostin toimitustesti";
  const intro = `Tämä on Mone Beauty Clinicin valtuutettu sähköpostin toimitustesti (${formatEmailDateTime(sentAt, locale)}). Toimenpiteitä ei tarvita.`;
  return {
    subject: "Mone Beauty Clinic – sähköpostin toimitustesti",
    text: `${intro}\n\n${plainTextFooter(locale)}`,
    html: renderEmailShell({
      locale,
      preheader: "Mone Beauty Clinicin sähköpostin toimitustesti.",
      heading,
      body: paragraph(intro, true),
    }),
  };
}
