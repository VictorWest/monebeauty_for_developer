import { redirect } from "next/navigation";
import {
  CalendarCheck,
  EnvelopeSimple,
  HouseLine,
  MapPin,
  Package,
  Phone,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react/ssr";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { accountHref } from "@/lib/account-routing";
import { localizedPath } from "@/lib/seo";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import {
  clientLogoutAction,
  deleteClientAddressAction,
  makeDefaultClientAddressAction,
  saveClientAddressAction,
  updateClientProfileAction,
  updateConsultationProfileAction,
} from "@/lib/client-account-actions";
import { ChangeRequestForm } from "@/components/account/ChangeRequestForm";
import { createOrderCancellationRequestAction } from "@/lib/order-cancellation-actions";
import { Container } from "@/components/ui/Container";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { CONTACT } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import type { SavedAddress } from "@prisma/client";
import {
  CANCELLATION_POLICY,
  CANCELLATION_POLICY_ANCHOR,
  cancellationPolicyText,
} from "@/content/cancellation-policy";
import {
  decryptSensitiveJson,
  decryptSensitiveText,
  isSensitiveDataEncryptionConfigured,
} from "@/lib/sensitive-data";
import { clinicTodayYmd } from "@/lib/clinic-date";
import {
  CONSULTATION_CONSENT_TYPES,
  currentConsultationConsentState,
} from "@/lib/consultation-consent-state";

const PAGE_SIZE = 10;
type View = "overview" | "appointments" | "orders" | "addresses" | "profile";

const COPY = {
  en: {
    title: "My account",
    welcome: "Welcome",
    overview: "Overview",
    appointments: "Appointments",
    orders: "Orders",
    addresses: "Saved addresses",
    profile: "Profile",
    signOut: "Sign out",
    verified: "Verified email",
    phone: "Phone",
    next: "Next appointment",
    latest: "Latest order",
    noUpcoming: "No upcoming appointments.",
    noOrders: "No website orders yet.",
    book: "Book online",
    upcoming: "Upcoming appointments",
    previous: "Previous appointments",
    practitioner: "Specialist",
    duration: "Duration",
    minutes: "min",
    reference: "Reference",
    clinic: "Clinic",
    paidAtClinic: "Appointments are paid at the clinic.",
    items: "Items",
    total: "Total",
    fulfilment: "Fulfilment",
    payment: "Payment",
    orderAddress: "Delivery address used",
    emptyAddress: "No saved addresses.",
    default: "Default",
    makeDefault: "Make default",
    edit: "Edit",
    remove: "Delete",
    addAddress: "Add address",
    editAddress: "Edit address",
    recipient: "Recipient",
    line1: "Address",
    line2: "Address line 2",
    postalCode: "Postal code",
    city: "City",
    save: "Save",
    profileIntro:
      "Your verified email is used to protect appointments and orders.",
    name: "Full name",
    noticeSaved: "Changes saved.",
    noticeDeleted: "Address deleted.",
    noticeInvalid: "Please check the entered details.",
    noticeLimit: "You can save up to 10 addresses.",
    consultationUnavailable:
      "The consultation form is temporarily unavailable. Please try again later.",
    pending: "A change request is awaiting review",
    previousPage: "Previous",
    nextPage: "Next",
    countAppointments: "Upcoming",
    countOrders: "Orders",
    cancelOrder: "Request cancellation",
    cancelReason: "Reason for cancellation",
    cancelHelp:
      "Tell the clinic why you want to cancel this order (3–500 characters).",
    cancellationPending: "Cancellation request pending",
    cancellationApproved: "Cancellation request approved",
    cancellationRejected: "Cancellation request rejected",
    cancellationRequested: "Cancellation request sent.",
    cancellationUnavailable: "This order can no longer be cancelled.",
  },
  fi: {
    title: "Oma tili",
    welcome: "Tervetuloa",
    overview: "Yhteenveto",
    appointments: "Ajanvaraukset",
    orders: "Tilaukset",
    addresses: "Tallennetut osoitteet",
    profile: "Profiili",
    signOut: "Kirjaudu ulos",
    verified: "Vahvistettu sähköposti",
    phone: "Puhelin",
    next: "Seuraava aika",
    latest: "Viimeisin tilaus",
    noUpcoming: "Ei tulevia ajanvarauksia.",
    noOrders: "Ei vielä verkkotilauksia.",
    book: "Varaa aika",
    upcoming: "Tulevat ajanvaraukset",
    previous: "Aiemmat ajanvaraukset",
    practitioner: "Asiantuntija",
    duration: "Kesto",
    minutes: "min",
    reference: "Viite",
    clinic: "Klinikka",
    paidAtClinic: "Ajanvaraukset maksetaan klinikalla.",
    items: "Tuotteet",
    total: "Yhteensä",
    fulfilment: "Toimitus",
    payment: "Maksu",
    orderAddress: "Tilauksessa käytetty osoite",
    emptyAddress: "Ei tallennettuja osoitteita.",
    default: "Oletus",
    makeDefault: "Aseta oletukseksi",
    edit: "Muokkaa",
    remove: "Poista",
    addAddress: "Lisää osoite",
    editAddress: "Muokkaa osoitetta",
    recipient: "Vastaanottaja",
    line1: "Osoite",
    line2: "Osoiterivi 2",
    postalCode: "Postinumero",
    city: "Kaupunki",
    save: "Tallenna",
    profileIntro:
      "Vahvistettua sähköpostia käytetään ajanvarausten ja tilausten suojaamiseen.",
    name: "Koko nimi",
    noticeSaved: "Muutokset tallennettu.",
    noticeDeleted: "Osoite poistettu.",
    noticeInvalid: "Tarkista antamasi tiedot.",
    noticeLimit: "Voit tallentaa enintään 10 osoitetta.",
    consultationUnavailable:
      "Esitietolomake ei ole tilapäisesti käytettävissä. Yritä myöhemmin uudelleen.",
    pending: "Muutospyyntö odottaa käsittelyä",
    previousPage: "Edellinen",
    nextPage: "Seuraava",
    countAppointments: "Tulevat",
    countOrders: "Tilaukset",
    cancelOrder: "Pyydä peruutusta",
    cancelReason: "Peruutuksen syy",
    cancelHelp:
      "Kerro klinikalle, miksi haluat perua tilauksen (3–500 merkkiä).",
    cancellationPending: "Peruutuspyyntö odottaa käsittelyä",
    cancellationApproved: "Peruutuspyyntö hyväksytty",
    cancellationRejected: "Peruutuspyyntö hylätty",
    cancellationRequested: "Peruutuspyyntö lähetetty.",
    cancellationUnavailable: "Tätä tilausta ei voi enää perua.",
  },
  ru: {
    title: "Личный кабинет",
    welcome: "Здравствуйте",
    overview: "Обзор",
    appointments: "Записи",
    orders: "Заказы",
    addresses: "Сохранённые адреса",
    profile: "Профиль",
    signOut: "Выйти",
    verified: "Подтверждённый email",
    phone: "Телефон",
    next: "Следующая запись",
    latest: "Последний заказ",
    noUpcoming: "Нет предстоящих записей.",
    noOrders: "Интернет-заказов пока нет.",
    book: "Записаться",
    upcoming: "Предстоящие записи",
    previous: "Прошлые записи",
    practitioner: "Специалист",
    duration: "Длительность",
    minutes: "мин",
    reference: "Номер",
    clinic: "Клиника",
    paidAtClinic: "Процедуры оплачиваются в клинике.",
    items: "Товары",
    total: "Итого",
    fulfilment: "Получение",
    payment: "Оплата",
    orderAddress: "Адрес этого заказа",
    emptyAddress: "Нет сохранённых адресов.",
    default: "По умолчанию",
    makeDefault: "Сделать основным",
    edit: "Изменить",
    remove: "Удалить",
    addAddress: "Добавить адрес",
    editAddress: "Изменить адрес",
    recipient: "Получатель",
    line1: "Адрес",
    line2: "Дополнительная строка",
    postalCode: "Индекс",
    city: "Город",
    save: "Сохранить",
    profileIntro: "Подтверждённый email защищает ваши записи и заказы.",
    name: "Полное имя",
    noticeSaved: "Изменения сохранены.",
    noticeDeleted: "Адрес удалён.",
    noticeInvalid: "Проверьте введённые данные.",
    noticeLimit: "Можно сохранить до 10 адресов.",
    consultationUnavailable:
      "Анкета временно недоступна. Пожалуйста, попробуйте ещё раз позже.",
    pending: "Запрос на изменение ожидает рассмотрения",
    previousPage: "Назад",
    nextPage: "Далее",
    countAppointments: "Предстоящие",
    countOrders: "Заказы",
    cancelOrder: "Запросить отмену",
    cancelReason: "Причина отмены",
    cancelHelp: "Сообщите клинике причину отмены заказа (3–500 символов).",
    cancellationPending: "Запрос на отмену ожидает рассмотрения",
    cancellationApproved: "Запрос на отмену одобрен",
    cancellationRejected: "Запрос на отмену отклонён",
    cancellationRequested: "Запрос на отмену отправлен.",
    cancellationUnavailable: "Этот заказ больше нельзя отменить.",
  },
} as const;

const STATUS_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    BOOKED: "Booked",
    CONFIRMED: "Confirmed",
    RESCHEDULED: "Rescheduled",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    PENDING: "Pending",
    PAID: "Paid",
    UNPAID: "Unpaid",
    PROCESSING: "Processing",
    FULFILLED: "Fulfilled",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partly refunded",
    FAILED: "Failed",
  },
  fi: {
    BOOKED: "Varattu",
    CONFIRMED: "Vahvistettu",
    RESCHEDULED: "Siirretty",
    COMPLETED: "Valmis",
    CANCELLED: "Peruttu",
    PENDING: "Odottaa",
    PAID: "Maksettu",
    UNPAID: "Maksamatta",
    PROCESSING: "Käsitellään",
    FULFILLED: "Toimitettu",
    REFUNDED: "Hyvitetty",
    PARTIALLY_REFUNDED: "Osittain hyvitetty",
    FAILED: "Epäonnistui",
  },
  ru: {
    BOOKED: "Забронировано",
    CONFIRMED: "Подтверждено",
    RESCHEDULED: "Перенесено",
    COMPLETED: "Завершено",
    CANCELLED: "Отменено",
    PENDING: "Ожидает",
    PAID: "Оплачено",
    UNPAID: "Не оплачено",
    PROCESSING: "Обрабатывается",
    FULFILLED: "Выполнено",
    REFUNDED: "Возвращено",
    PARTIALLY_REFUNDED: "Частичный возврат",
    FAILED: "Ошибка",
  },
};

type DashboardCopy = (typeof COPY)[Locale];
type AppointmentSummaryData = {
  id: string;
  start: Date;
  end: Date;
  status: string;
  procedureTitle: string | null;
  service: { slug: string; contents: Array<{ h1: string }> };
  practitioner: { name: string; publicName: string | null };
};
type OrderSummaryData = {
  id: string;
  createdAt: Date;
  status: string;
  total: unknown;
};

function pageHref(locale: Locale, view: View, page?: number, edit?: string) {
  const query = new URLSearchParams({ view });
  if (page && page > 1) query.set("page", String(page));
  if (edit) query.set("edit", edit);
  return `${accountHref(locale)}?${query}`;
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "en" || raw === "ru" ? raw : "fi") as Locale;
  const cancellationPolicy = CANCELLATION_POLICY[locale];
  const cancellationPolicyHref = `${localizedPath(PUBLIC_PATHS.terms, locale)}#${CANCELLATION_POLICY_ANCHOR}`;
  const user = await currentUser("client");
  if (!user || user.role !== "CLIENT") redirect(accountHref(locale, "login"));
  const query = await searchParams;
  const view = (
    ["overview", "appointments", "orders", "addresses", "profile"].includes(
      query.view ?? "",
    )
      ? query.view
      : "overview"
  ) as View;
  const page = Math.max(1, Number(query.page) || 1);
  const client = await prisma.client.findUnique({
    where: { userId: user.id },
    include: {
      appointments: {
        orderBy: { start: "desc" },
        include: {
          service: {
            include: {
              contents: {
                where: { locale, status: "PUBLISHED" },
                take: 1,
                select: { h1: true },
              },
            },
          },
          practitioner: { select: { name: true, publicName: true } },
          serviceOption: { select: { key: true } },
          changeRequests: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          cancellationRequests: { orderBy: { createdAt: "desc" } },
        },
      },
      savedAddresses: {
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      },
      consultationProfile: true,
      consents: {
        where: { type: { in: [...CONSULTATION_CONSENT_TYPES] } },
        orderBy: [{ at: "desc" }, { id: "desc" }],
        distinct: ["type"],
        select: { type: true, granted: true, textVersion: true },
      },
    },
  });
  if (!client) redirect(accountHref(locale, "login"));
  const consultationForm = await prisma.consultationForm.findUnique({
    where: { id: "current" },
    include: {
      questions: {
        where: { active: true, archivedAt: null },
        orderBy: { displayOrder: "asc" },
        include: {
          contents: { where: { locale } },
          choices: {
            where: { active: true },
            orderBy: { displayOrder: "asc" },
            include: { contents: { where: { locale } } },
          },
        },
      },
    },
  });
  let consultationUnavailable = !isSensitiveDataEncryptionConfigured();
  let consultationAnswers: Array<{
    key: string;
    answer: string | string[] | boolean;
  }> = [];
  let consultationDob = "";
  if (client.consultationProfile && !consultationUnavailable) {
    try {
      consultationAnswers = decryptSensitiveJson(
        client.consultationProfile.answersEncrypted,
      );
      consultationDob = decryptSensitiveText(
        client.consultationProfile.dateOfBirthEncrypted,
      );
    } catch {
      consultationUnavailable = true;
      consultationAnswers = [];
      consultationDob = "";
    }
  }
  const consultationAnswer = new Map(
    consultationAnswers.map((item) => [item.key, item.answer]),
  );
  const consultationCurrent = Boolean(
    consultationForm &&
    client.consultationProfile &&
    client.consultationProfile.completedVersion >=
      consultationForm.requiredVersion,
  );
  const consultationConsentState = consultationForm
    ? currentConsultationConsentState(client.consents, {
        health_profile: consultationForm.healthConsentVersion,
        consultation_accuracy: consultationForm.accuracyVersion,
      })
    : { healthDataConsent: false, accuracyAcknowledged: false };
  const localizedWording = (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? String((value as Record<string, unknown>)[locale] ?? "")
      : "";
  const t = COPY[locale];
  const now = new Date();
  const upcoming = client.appointments
    .filter((a) => a.start >= now && a.status !== "CANCELLED")
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const previous = client.appointments.filter(
    (a) => a.start < now || a.status === "CANCELLED",
  );
  const allAppointments = [...upcoming, ...previous];
  const shownAppointments = allAppointments.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const shownOrders = client.orders.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Helsinki",
  });
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  });
  const editing = query.edit
    ? client.savedAddresses.find((a) => a.id === query.edit)
    : undefined;
  const notice =
    query.notice === "cancellation_requested"
      ? t.cancellationRequested
      : query.notice === "cancellation_unavailable"
        ? t.cancellationUnavailable
        : query.notice === "cancellation_pending"
          ? t.cancellationPending
          : query.notice === "cancellation_invalid"
            ? t.noticeInvalid
            : query.notice === "saved"
              ? t.noticeSaved
              : query.notice === "consultation_unavailable"
                ? t.consultationUnavailable
                : query.notice === "deleted"
                  ? t.noticeDeleted
                  : query.notice === "limit"
                    ? t.noticeLimit
                    : query.notice === "invalid"
                      ? t.noticeInvalid
                      : null;
  const viewTitle = t[view];

  return (
    <section className="bg-page py-[clamp(28px,5vw,64px)]">
      <Container>
        <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 xl:gap-10">
          <aside className="rounded-[8px] border border-line-card bg-card p-4 shadow-card sm:p-5 lg:sticky lg:top-6">
            <div className="min-w-0 border-b border-line-hair pb-4">
              <p className="font-sans text-[11px] tracking-[.14em] text-muted uppercase">
                {t.welcome}
              </p>
              <p className="mt-1.5 font-display text-[28px] leading-tight font-medium break-words text-ink">
                {client.fullName}
              </p>
              <p className="mt-3 flex min-w-0 items-start gap-2 font-sans text-sm leading-5 text-body">
                <EnvelopeSimple
                  size={17}
                  weight="thin"
                  className="mt-0.5 shrink-0 text-accent"
                />
                <span className="min-w-0 break-all">{user.email}</span>
              </p>
              <p className="mt-1 pl-[25px] font-sans text-[11px] tracking-[.06em] text-muted uppercase">
                {t.verified}
              </p>
            </div>

            <nav className="mt-3 grid gap-1" aria-label={t.title}>
              {(
                [
                  ["overview", t.overview, HouseLine],
                  ["appointments", t.appointments, CalendarCheck],
                  ["orders", t.orders, Package],
                  ["addresses", t.addresses, MapPin],
                  ["profile", t.profile, UserCircle],
                ] as const
              ).map(([key, label, Icon]) => (
                <a
                  key={key}
                  href={pageHref(locale, key)}
                  aria-current={view === key ? "page" : undefined}
                  className={`flex min-h-11 min-w-0 items-center gap-3 rounded px-3 font-sans text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${view === key ? "bg-btn-fill font-medium text-ink" : "text-body hover:bg-page"}`}
                >
                  <Icon size={19} weight="thin" className="shrink-0" />
                  <span className="min-w-0 break-words">{label}</span>
                </a>
              ))}
            </nav>

            <form action={clientLogoutAction} className="mt-3">
              <input type="hidden" name="locale" value={locale} />
              <button className={`${secondaryButton} w-full justify-center`}>
                <SignOut size={17} />
                {t.signOut}
              </button>
            </form>
          </aside>

          <main className="min-w-0">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line-hair pb-5">
              <div className="min-w-0">
                <p className="font-sans text-[11px] tracking-[.16em] text-muted uppercase">
                  {t.title}
                </p>
                <h1 className="mt-1 font-display text-[clamp(36px,5vw,52px)] leading-[1.05] font-medium break-words text-ink">
                  {viewTitle}
                </h1>
              </div>
              {view === "overview" ? (
                <a
                  href={localizedPath(PUBLIC_PATHS.booking, locale)}
                  className={primaryButton}
                >
                  {t.book}
                </a>
              ) : null}
            </header>
            {notice ? (
              <p
                role="status"
                className="mb-4 rounded border border-line-btn bg-btn-fill px-4 py-3 font-sans text-sm leading-6 break-words"
              >
                {notice}
              </p>
            ) : null}
            {view === "overview" ? (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Stat
                    icon={EnvelopeSimple}
                    label={t.verified}
                    value={user.email}
                  />
                  <Stat icon={Phone} label={t.phone} value={client.phone} />
                  <Stat
                    icon={CalendarCheck}
                    label={t.countAppointments}
                    value={String(upcoming.length)}
                  />
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <section className={panel}>
                    <h2 className={heading}>{t.next}</h2>
                    {upcoming[0] ? (
                      <AppointmentSummary
                        appointment={upcoming[0]}
                        locale={locale}
                        dateTime={dateTime}
                        t={t}
                      />
                    ) : (
                      <Empty text={t.noUpcoming} />
                    )}
                  </section>
                  <section className={panel}>
                    <h2 className={heading}>{t.latest}</h2>
                    {client.orders[0] ? (
                      <OrderSummary
                        order={client.orders[0]}
                        locale={locale}
                        money={money}
                        t={t}
                      />
                    ) : (
                      <Empty text={t.noOrders} />
                    )}
                  </section>
                </div>
              </div>
            ) : null}

            {view === "appointments" ? (
              <section>
                <aside className="rounded border border-line-card bg-alt px-4 py-3 font-sans text-sm leading-6 break-words text-body sm:px-5">
                  <strong>{cancellationPolicy.title}:</strong>{" "}
                  {cancellationPolicyText(locale)}{" "}
                  <a
                    href={cancellationPolicyHref}
                    className="rounded-sm font-medium text-accent underline decoration-accent/45 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {cancellationPolicy.linkLabel}
                  </a>
                </aside>
                <div className="mt-4 grid gap-4">
                  {shownAppointments.length ? (
                    shownAppointments.map((appointment) => {
                      const pending =
                        appointment.changeRequests[0]?.status === "PENDING";
                      const allow =
                        appointment.start > now &&
                        appointment.status !== "CANCELLED";
                      return (
                        <article key={appointment.id} className={panel}>
                          <AppointmentSummary
                            appointment={appointment}
                            locale={locale}
                            dateTime={dateTime}
                            t={t}
                          />
                          <div className={metadataRows}>
                            <p>
                              <strong>{t.clinic}:</strong>{" "}
                              {CONTACT.address.street},{" "}
                              {CONTACT.address.postalCode}{" "}
                              {CONTACT.address.city}
                            </p>
                            <p>{t.paidAtClinic}</p>
                          </div>
                          {pending ? (
                            <p className="mt-4 rounded bg-btn-fill px-3 py-2 font-sans text-sm">
                              {t.pending}
                            </p>
                          ) : allow ? (
                            <ChangeRequestForm
                              appointmentId={appointment.id}
                              serviceSlug={appointment.service.slug}
                              optionKey={appointment.serviceOption?.key}
                              locale={locale}
                            />
                          ) : null}
                        </article>
                      );
                    })
                  ) : (
                    <Empty text={t.noUpcoming} />
                  )}
                </div>
                <Pager
                  locale={locale}
                  view={view}
                  page={page}
                  count={allAppointments.length}
                  t={t}
                />
              </section>
            ) : null}

            {view === "orders" ? (
              <section>
                <div className="grid gap-4">
                  {shownOrders.length ? (
                    shownOrders.map((order) => {
                      const latestRequest = order.cancellationRequests[0];
                      const pendingRequest = order.cancellationRequests.find(
                        (request) => request.status === "PENDING",
                      );
                      const cancellable = ![
                        "SHIPPED",
                        "FULFILLED",
                        "CANCELLED",
                      ].includes(order.status);
                      return (
                        <article key={order.id} className={panel}>
                          <OrderSummary
                            order={order}
                            locale={locale}
                            money={money}
                            t={t}
                          />
                          <div className={metadataRows}>
                            <p>
                              <strong>{t.items}:</strong>{" "}
                              {order.items
                                .map((item) => `${item.qty} × ${item.name}`)
                                .join(", ")}
                            </p>
                            <p>
                              <strong>{t.fulfilment}:</strong>{" "}
                              {order.fulfillmentMethod ?? "—"} ·{" "}
                              <strong>{t.payment}:</strong>{" "}
                              {order.paymentStatus}
                            </p>
                            {order.shippingAddress ? (
                              <p>
                                <strong>{t.orderAddress}:</strong>{" "}
                                {formatAddressSnapshot(order.shippingAddress)}
                              </p>
                            ) : null}
                          </div>
                          {latestRequest ? (
                            <p
                              className="mt-4 rounded bg-btn-fill px-3 py-2 font-sans text-sm text-body"
                              role="status"
                            >
                              {latestRequest.status === "PENDING"
                                ? t.cancellationPending
                                : latestRequest.status === "APPROVED"
                                  ? t.cancellationApproved
                                  : t.cancellationRejected}
                              {latestRequest.decisionReason
                                ? `: ${latestRequest.decisionReason}`
                                : ""}
                            </p>
                          ) : null}
                          {cancellable && !pendingRequest ? (
                            <form
                              action={createOrderCancellationRequestAction}
                              className="mt-4 grid gap-3 border-t border-line-hair pt-4"
                            >
                              <input
                                type="hidden"
                                name="locale"
                                value={locale}
                              />
                              <input
                                type="hidden"
                                name="orderId"
                                value={order.id}
                              />
                              <label
                                className="font-sans text-sm font-medium text-ink"
                                htmlFor={`cancel-order-${order.id}`}
                              >
                                {t.cancelReason}
                              </label>
                              <p
                                id={`cancel-help-${order.id}`}
                                className="font-sans text-xs leading-5 text-muted"
                              >
                                {t.cancelHelp}
                              </p>
                              <textarea
                                id={`cancel-order-${order.id}`}
                                name="reason"
                                required
                                minLength={3}
                                maxLength={500}
                                rows={3}
                                aria-describedby={`cancel-help-${order.id}`}
                                className={`${input} min-h-24 py-2`}
                              />
                              <button
                                className={`${secondaryButton} w-fit border-accent font-medium text-accent`}
                              >
                                {t.cancelOrder}
                              </button>
                            </form>
                          ) : null}
                        </article>
                      );
                    })
                  ) : (
                    <Empty text={t.noOrders} />
                  )}
                </div>
                <Pager
                  locale={locale}
                  view={view}
                  page={page}
                  count={client.orders.length}
                  t={t}
                />
              </section>
            ) : null}

            {view === "addresses" ? (
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <section>
                  <div className="grid gap-3">
                    {client.savedAddresses.length ? (
                      client.savedAddresses.map((address) => (
                        <article key={address.id} className={panel}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-display text-2xl font-medium">
                                {address.recipientName}
                              </h3>
                              <p className="mt-2 font-sans text-sm leading-6 break-words text-body">
                                {address.line1}
                                {address.line2 ? (
                                  <>
                                    <br />
                                    {address.line2}
                                  </>
                                ) : null}
                                <br />
                                {address.postalCode} {address.city}
                                <br />
                                {address.phone}
                              </p>
                            </div>
                            {address.isDefault ? (
                              <span className={statusBadge}>{t.default}</span>
                            ) : null}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <a
                              href={pageHref(
                                locale,
                                "addresses",
                                undefined,
                                address.id,
                              )}
                              className={smallButton}
                            >
                              {t.edit}
                            </a>
                            {!address.isDefault ? (
                              <form action={makeDefaultClientAddressAction}>
                                <Hidden locale={locale} id={address.id} />
                                <button className={smallButton}>
                                  {t.makeDefault}
                                </button>
                              </form>
                            ) : null}
                            <form action={deleteClientAddressAction}>
                              <Hidden locale={locale} id={address.id} />
                              <button className={smallButton}>
                                {t.remove}
                              </button>
                            </form>
                          </div>
                        </article>
                      ))
                    ) : (
                      <Empty text={t.emptyAddress} />
                    )}
                  </div>
                </section>
                <AddressForm locale={locale} address={editing} t={t} />
              </div>
            ) : null}

            {view === "profile" ? (
              <section className={panel}>
                <p className="font-sans text-sm leading-6 text-muted">
                  {t.profileIntro}
                </p>
                <form
                  action={updateClientProfileAction}
                  className="mt-6 grid max-w-[720px] gap-4"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={
                        locale === "fi"
                          ? "Etunimi"
                          : locale === "ru"
                            ? "Имя"
                            : "First name"
                      }
                    >
                      <input
                        name="firstName"
                        required
                        defaultValue={
                          client.firstName ?? client.fullName.split(/\s+/)[0]
                        }
                        className={input}
                      />
                    </Field>
                    <Field
                      label={
                        locale === "fi"
                          ? "Sukunimi"
                          : locale === "ru"
                            ? "Фамилия"
                            : "Last name"
                      }
                    >
                      <input
                        name="lastName"
                        required
                        defaultValue={
                          client.lastName ??
                          client.fullName.split(/\s+/).slice(1).join(" ")
                        }
                        className={input}
                      />
                    </Field>
                  </div>
                  <Field label={t.verified}>
                    <input
                      value={user.email}
                      readOnly
                      className={`${input} opacity-70`}
                    />
                  </Field>
                  <Field label={t.phone}>
                    <input
                      name="phone"
                      required
                      type="tel"
                      defaultValue={client.phone}
                      className={input}
                    />
                  </Field>
                  <button className={primaryButton}>{t.save}</button>
                </form>

                <div className="mt-8 border-t border-line-hair pt-7">
                  <h2 className="font-display text-2xl font-medium text-ink">
                    {locale === "fi"
                      ? "Esitietolomake"
                      : locale === "ru"
                        ? "Анкета"
                        : "Consultation form"}
                  </h2>
                  <p className="mt-2 font-sans text-sm leading-6 text-body">
                    {consultationCurrent
                      ? locale === "fi"
                        ? "Esitiedot ovat ajan tasalla."
                        : locale === "ru"
                          ? "Анкета актуальна."
                          : "Your consultation information is current."
                      : locale === "fi"
                        ? "Täytä tai vahvista esitiedot ennen seuraavaa ajanvarausta."
                        : locale === "ru"
                          ? "Заполните или подтвердите анкету перед следующей записью."
                          : "Complete or reconfirm this form before your next booking."}
                  </p>
                  {consultationUnavailable ? (
                    <p
                      role="alert"
                      className="bg-accent-soft mt-5 rounded-[6px] border border-accent/30 px-4 py-3 font-sans text-sm leading-6 text-ink"
                    >
                      {t.consultationUnavailable}
                    </p>
                  ) : consultationForm ? (
                    <form
                      action={updateConsultationProfileAction}
                      className="mt-5 grid max-w-[720px] gap-4"
                    >
                      <input type="hidden" name="locale" value={locale} />
                      <p className="bg-surface rounded-[6px] border border-line-hair px-4 py-3 font-sans text-sm leading-6 text-body">
                        {localizedWording(
                          consultationForm.requiredInformationWording,
                        )}
                      </p>
                      <div>
                        <span className="mb-1.5 block font-sans text-xs tracking-[.08em] text-muted uppercase">
                          {locale === "fi"
                            ? "Syntymäaika"
                            : locale === "ru"
                              ? "Дата рождения"
                              : "Date of birth"}
                        </span>
                        <DatePicker
                          id="consultation-date-of-birth"
                          name="dateOfBirth"
                          locale={locale}
                          ariaLabel={
                            locale === "fi"
                              ? "Valitse syntymäaika"
                              : locale === "ru"
                                ? "Выберите дату рождения"
                                : "Select date of birth"
                          }
                          placeholder={
                            locale === "fi"
                              ? "Valitse syntymäaika"
                              : locale === "ru"
                                ? "Выберите дату рождения"
                                : "Select date of birth"
                          }
                          autoComplete="bday"
                          defaultValue={consultationDob}
                          max={clinicTodayYmd()}
                          disableClosedDays={false}
                          navigation="dateOfBirth"
                          required
                        />
                      </div>
                      {consultationForm.questions.map((question) => {
                        const prompt = question.contents[0]?.prompt;
                        if (!prompt) return null;
                        const fieldName = `consultation_${question.key}`;
                        const saved = consultationAnswer.get(question.key);
                        if (
                          question.type === "SHORT_TEXT" ||
                          question.type === "LONG_TEXT"
                        )
                          return (
                            <Field key={question.id} label={prompt}>
                              {question.type === "LONG_TEXT" ? (
                                <textarea
                                  name={fieldName}
                                  className={`${input} min-h-28 py-3`}
                                  defaultValue={
                                    typeof saved === "string" ? saved : ""
                                  }
                                  required={question.required}
                                />
                              ) : (
                                <input
                                  name={fieldName}
                                  className={input}
                                  defaultValue={
                                    typeof saved === "string" ? saved : ""
                                  }
                                  required={question.required}
                                />
                              )}
                            </Field>
                          );
                        if (question.type === "ACKNOWLEDGMENT")
                          return (
                            <label
                              key={question.id}
                              className="flex gap-2 font-sans text-sm text-body"
                            >
                              <input
                                type="checkbox"
                                name={fieldName}
                                defaultChecked={saved === true}
                                required={question.required}
                                className="accent-accent"
                              />
                              {prompt}
                            </label>
                          );
                        const choices =
                          question.type === "YES_NO"
                            ? [
                                {
                                  key: "yes",
                                  label:
                                    locale === "fi"
                                      ? "Kyllä"
                                      : locale === "ru"
                                        ? "Да"
                                        : "Yes",
                                },
                                {
                                  key: "no",
                                  label:
                                    locale === "fi"
                                      ? "Ei"
                                      : locale === "ru"
                                        ? "Нет"
                                        : "No",
                                },
                              ]
                            : question.choices.map((choice) => ({
                                key: choice.key,
                                label: choice.contents[0]?.label ?? choice.key,
                              }));
                        return (
                          <fieldset
                            key={question.id}
                            className="grid gap-2 font-sans text-sm text-body"
                          >
                            <legend>{prompt}</legend>
                            {choices.map((choice) => (
                              <label key={choice.key} className="flex gap-2">
                                <input
                                  type={
                                    question.type === "MULTI_CHOICE"
                                      ? "checkbox"
                                      : "radio"
                                  }
                                  name={fieldName}
                                  value={choice.key}
                                  defaultChecked={
                                    Array.isArray(saved)
                                      ? saved.includes(choice.key)
                                      : saved === choice.key
                                  }
                                  required={
                                    question.required &&
                                    question.type !== "MULTI_CHOICE"
                                  }
                                  className="accent-accent"
                                />
                                {choice.label}
                              </label>
                            ))}
                          </fieldset>
                        );
                      })}
                      <label className="flex gap-2 font-sans text-sm leading-6 text-body">
                        <input
                          type="checkbox"
                          name="healthDataConsent"
                          defaultChecked={
                            consultationConsentState.healthDataConsent
                          }
                          required
                          className="accent-accent"
                        />
                        {localizedWording(
                          consultationForm.healthConsentWording,
                        )}
                      </label>
                      <label className="flex gap-2 font-sans text-sm leading-6 text-body">
                        <input
                          type="checkbox"
                          name="accuracyAcknowledged"
                          defaultChecked={
                            consultationConsentState.accuracyAcknowledged
                          }
                          required
                          className="accent-accent"
                        />
                        {localizedWording(consultationForm.accuracyWording)}
                      </label>
                      <button className={primaryButton}>{t.save}</button>
                    </form>
                  ) : null}
                </div>
              </section>
            ) : null}
          </main>
        </div>
      </Container>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof EnvelopeSimple;
  label: string;
  value: string;
}) {
  return (
    <div className={panel}>
      <Icon size={22} weight="thin" className="text-accent" />
      <p className="mt-3 font-sans text-xs tracking-[.08em] text-muted uppercase">
        {label}
      </p>
      <p className="mt-1 font-sans text-base break-words text-ink">{value}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="mt-3 font-sans text-sm leading-6 text-muted">{text}</p>;
}
function AppointmentSummary({
  appointment,
  locale,
  dateTime,
  t,
}: {
  appointment: AppointmentSummaryData;
  locale: Locale;
  dateTime: Intl.DateTimeFormat;
  t: DashboardCopy;
}) {
  const title =
    appointment.procedureTitle ??
    appointment.service.contents[0]?.h1 ??
    appointment.service.slug;
  return (
    <div>
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <h3 className="min-w-0 font-display text-[27px] leading-tight font-medium break-words text-ink">
          {title}
        </h3>
        <span className={statusBadge}>
          {STATUS_LABELS[locale][appointment.status] ?? appointment.status}
        </span>
      </div>
      <p className="mt-2 font-sans text-sm text-body">
        {dateTime.format(appointment.start)}–
        {new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Helsinki",
        }).format(appointment.end)}
      </p>
      <div className="mt-3 grid gap-x-5 gap-y-1 font-sans text-xs leading-5 text-muted sm:grid-cols-2 xl:grid-cols-3">
        <span>
          {t.practitioner}:{" "}
          {appointment.practitioner.publicName ??
            appointment.practitioner.name.split(/\s+/)[0]}
        </span>
        <span>
          {t.duration}:{" "}
          {Math.round(
            (appointment.end.getTime() - appointment.start.getTime()) / 60000,
          )}{" "}
          {t.minutes}
        </span>
        <span>
          {t.reference}: {appointment.id.slice(-8).toUpperCase()}
        </span>
      </div>
    </div>
  );
}
function OrderSummary({
  order,
  locale,
  money,
  t,
}: {
  order: OrderSummaryData;
  locale: Locale;
  money: Intl.NumberFormat;
  t: DashboardCopy;
}) {
  return (
    <div>
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h3 className="font-display text-[27px] font-medium">
            #{order.id.slice(-8).toUpperCase()}
          </h3>
          <p className="mt-1 font-sans text-sm text-muted">
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              order.createdAt,
            )}
          </p>
        </div>
        <span className={statusBadge}>
          {STATUS_LABELS[locale][order.status] ?? order.status}
        </span>
      </div>
      <p className="mt-3 font-sans text-sm">
        <strong>{t.total}:</strong> {money.format(Number(order.total))}
      </p>
    </div>
  );
}
function formatAddressSnapshot(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  const a = value as Record<string, unknown>;
  return [
    a.name ?? a.recipientName,
    a.line1 ?? a.address_line_1,
    a.line2 ?? a.address_line_2,
    [a.postalCode ?? a.postal_code, a.city].filter(Boolean).join(" "),
    a.country,
  ]
    .filter(Boolean)
    .join(", ");
}
function Pager({
  locale,
  view,
  page,
  count,
  t,
}: {
  locale: Locale;
  view: View;
  page: number;
  count: number;
  t: DashboardCopy;
}) {
  if (count <= PAGE_SIZE) return null;
  return (
    <nav
      className="mt-5 flex flex-wrap gap-2"
      aria-label={`${t.previousPage} / ${t.nextPage}`}
    >
      {page > 1 ? (
        <a className={smallButton} href={pageHref(locale, view, page - 1)}>
          {t.previousPage}
        </a>
      ) : null}
      {page * PAGE_SIZE < count ? (
        <a className={smallButton} href={pageHref(locale, view, page + 1)}>
          {t.nextPage}
        </a>
      ) : null}
    </nav>
  );
}
function Hidden({ locale, id }: { locale: Locale; id: string }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
    </>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block font-sans text-xs tracking-[.08em] text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
function AddressForm({
  locale,
  address,
  t,
}: {
  locale: Locale;
  address?: SavedAddress;
  t: DashboardCopy;
}) {
  return (
    <section className={panel}>
      <h2 className={heading}>{address ? t.editAddress : t.addAddress}</h2>
      <form action={saveClientAddressAction} className="mt-5 grid gap-3">
        <Hidden locale={locale} id={address?.id ?? ""} />
        <Field label={t.recipient}>
          <input
            name="recipientName"
            required
            defaultValue={address?.recipientName ?? ""}
            className={input}
          />
        </Field>
        <Field label={t.phone}>
          <input
            name="phone"
            required
            type="tel"
            defaultValue={address?.phone ?? ""}
            className={input}
          />
        </Field>
        <Field label={t.line1}>
          <input
            name="line1"
            required
            defaultValue={address?.line1 ?? ""}
            className={input}
          />
        </Field>
        <Field label={t.line2}>
          <input
            name="line2"
            defaultValue={address?.line2 ?? ""}
            className={input}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.postalCode}>
            <input
              name="postalCode"
              required
              pattern="[0-9]{5}"
              defaultValue={address?.postalCode ?? ""}
              className={input}
            />
          </Field>
          <Field label={t.city}>
            <input
              name="city"
              required
              defaultValue={address?.city ?? ""}
              className={input}
            />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2 font-sans text-sm">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={address?.isDefault ?? false}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {t.default}
        </label>
        <button className={primaryButton}>{t.save}</button>
      </form>
    </section>
  );
}

const panel =
  "min-w-0 rounded-[8px] border border-line-card bg-card p-5 shadow-card sm:p-6";
const heading = "font-display text-[clamp(28px,4vw,38px)] font-medium text-ink";
const input =
  "min-h-11 w-full rounded border border-line-btn bg-page px-3 font-sans text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25";
const smallButton =
  "inline-flex min-h-11 items-center rounded border border-line-btn bg-card px-3 font-sans text-xs transition-colors hover:bg-btn-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primaryButton =
  "inline-flex min-h-11 w-fit items-center justify-center rounded bg-accent px-5 font-sans text-xs font-medium tracking-[.1em] text-page uppercase transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondaryButton =
  "inline-flex min-h-11 items-center gap-2 rounded border border-line-btn bg-card px-4 font-sans text-sm transition-colors hover:bg-btn-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const metadataRows =
  "mt-4 grid min-w-0 gap-2 border-t border-line-hair pt-4 font-sans text-sm leading-6 break-words text-body sm:grid-cols-2";
const statusBadge =
  "w-fit max-w-full rounded-full bg-btn-fill px-3 py-1 font-sans text-[11px] leading-5 break-words uppercase sm:justify-self-end";
