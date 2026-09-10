import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import {
  CalendarCheck,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { prisma } from "@/lib/db";
import { Container } from "@/components/ui/Container";
import {
  ManageAppointment,
  type ManageCopy,
} from "@/components/booking/ManageAppointment";
import {
  appointmentIdFromManageToken,
  validAppointmentManageToken,
} from "@/lib/appointment-access";
import { localizedPath } from "@/lib/seo";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { CONTACT } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import {
  CANCELLATION_POLICY,
  CANCELLATION_POLICY_ANCHOR,
  cancellationPolicyText,
} from "@/content/cancellation-policy";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    metaTitle: "Manage your appointment",
    eyebrow: "Mone Beauty Clinic",
    title: "Manage your appointment",
    lead: "Reschedule or cancel your appointment below. Changes take effect immediately.",
    service: "Treatment",
    procedure: "Procedure",
    time: "Time",
    specialist: "Specialist",
    duration: "Duration",
    minutes: "min",
    reference: "Reference",
    status: "Status",
    paidAtClinic: "Appointments are paid at the clinic.",
    clinic: "Clinic",
    invalidTitle: "This link is no longer valid",
    invalidBody:
      "The link may have expired, or the appointment may already have been changed. Please call the clinic and we will help you.",
    pastTitle: "This appointment can no longer be changed",
    pastBody:
      "It has already taken place or is about to start. Please call the clinic if you need help.",
    cancelledTitle: "This appointment is cancelled",
    cancelledBody:
      "Nothing further is needed. You are welcome to book a new time whenever it suits you.",
    doneCancelled:
      "Your appointment has been cancelled. We have emailed you a confirmation.",
    doneRescheduled:
      "Your appointment has been moved. We have emailed you the new details.",
    errorSlotTaken:
      "That time was taken while you were choosing. Please pick another one.",
    errorInvalidTime: "Please choose a valid time.",
    errorInvalid:
      "We could not apply that change. Please call the clinic and we will help you.",
    book: "Book a new time",
    manage: {
      reschedule: "Reschedule",
      cancel: "Cancel appointment",
      confirmReschedule: "Confirm new time",
      confirmCancel: "Confirm cancellation",
      cancelWarning:
        "Your time will be released immediately and cannot be restored.",
      reason: "Reason (optional)",
      back: "Back",
      loading: "Loading times…",
      none: "No available times.",
    },
  },
  fi: {
    metaTitle: "Hallinnoi ajanvaraustasi",
    eyebrow: "Mone Beauty Clinic",
    title: "Hallinnoi ajanvaraustasi",
    lead: "Voit siirtää tai peruuttaa aikasi alta. Muutokset tulevat voimaan heti.",
    service: "Hoito",
    procedure: "Toimenpide",
    time: "Aika",
    specialist: "Asiantuntija",
    duration: "Kesto",
    minutes: "min",
    reference: "Viite",
    status: "Tila",
    paidAtClinic: "Ajanvaraukset maksetaan klinikalla.",
    clinic: "Klinikka",
    invalidTitle: "Linkki ei ole enää voimassa",
    invalidBody:
      "Linkki on voinut vanhentua tai ajanvaraus on jo muuttunut. Soita klinikalle, niin autamme sinua.",
    pastTitle: "Tätä aikaa ei voi enää muuttaa",
    pastBody:
      "Aika on jo mennyt tai alkamassa. Soita klinikalle, jos tarvitset apua.",
    cancelledTitle: "Tämä ajanvaraus on peruttu",
    cancelledBody:
      "Muuta ei tarvita. Voit varata uuden ajan silloin kun sinulle sopii.",
    doneCancelled:
      "Ajanvarauksesi on peruttu. Lähetimme vahvistuksen sähköpostiisi.",
    doneRescheduled:
      "Ajanvarauksesi on siirretty. Lähetimme uudet tiedot sähköpostiisi.",
    errorSlotTaken: "Aika ehti varautua valinnan aikana. Valitse toinen aika.",
    errorInvalidTime: "Valitse kelvollinen aika.",
    errorInvalid:
      "Muutosta ei voitu tehdä. Soita klinikalle, niin autamme sinua.",
    book: "Varaa uusi aika",
    manage: {
      reschedule: "Siirrä aikaa",
      cancel: "Peruuta aika",
      confirmReschedule: "Vahvista uusi aika",
      confirmCancel: "Vahvista peruutus",
      cancelWarning: "Aikasi vapautuu heti, eikä sitä voi palauttaa.",
      reason: "Syy (vapaaehtoinen)",
      back: "Takaisin",
      loading: "Haetaan aikoja…",
      none: "Ei vapaita aikoja.",
    },
  },
  ru: {
    metaTitle: "Управление записью",
    eyebrow: "Mone Beauty Clinic",
    title: "Управление записью",
    lead: "Ниже вы можете перенести или отменить визит. Изменения вступают в силу сразу.",
    service: "Услуга",
    procedure: "Процедура",
    time: "Время",
    specialist: "Специалист",
    duration: "Длительность",
    minutes: "мин",
    reference: "Номер",
    status: "Статус",
    paidAtClinic: "Процедуры оплачиваются в клинике.",
    clinic: "Клиника",
    invalidTitle: "Ссылка больше не действительна",
    invalidBody:
      "Срок действия ссылки мог истечь, либо запись уже изменена. Позвоните в клинику, и мы поможем.",
    pastTitle: "Эту запись больше нельзя изменить",
    pastBody:
      "Визит уже состоялся или скоро начнётся. Позвоните в клинику, если нужна помощь.",
    cancelledTitle: "Эта запись отменена",
    cancelledBody:
      "Больше ничего делать не нужно. Вы можете записаться снова в удобное время.",
    doneCancelled:
      "Ваша запись отменена. Подтверждение отправлено на вашу почту.",
    doneRescheduled:
      "Ваша запись перенесена. Новые детали отправлены на вашу почту.",
    errorSlotTaken:
      "Это время заняли, пока вы выбирали. Пожалуйста, выберите другое.",
    errorInvalidTime: "Выберите корректное время.",
    errorInvalid:
      "Не удалось применить изменение. Позвоните в клинику, и мы поможем.",
    book: "Записаться заново",
    manage: {
      reschedule: "Перенести",
      cancel: "Отменить запись",
      confirmReschedule: "Подтвердить новое время",
      confirmCancel: "Подтвердить отмену",
      cancelWarning:
        "Время освободится сразу, и восстановить его будет нельзя.",
      reason: "Причина (необязательно)",
      back: "Назад",
      loading: "Загрузка…",
      none: "Нет свободного времени.",
    },
  },
} as const satisfies Record<
  Locale,
  { manage: ManageCopy } & Record<string, unknown>
>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = COPY[localeOf(locale)];
  return { title: t.metaTitle, robots: { index: false, follow: false } };
}

function localeOf(raw: string): Locale {
  return raw === "en" || raw === "ru" ? raw : "fi";
}

export default async function ManageAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = localeOf(raw);
  setRequestLocale(locale);
  const { token = "", done, error } = await searchParams;
  const t = COPY[locale];
  const policy = CANCELLATION_POLICY[locale];
  const policyHref = `${localizedPath(PUBLIC_PATHS.terms, locale)}#${CANCELLATION_POLICY_ANCHOR}`;

  const id = token ? appointmentIdFromManageToken(token) : null;
  const appointment =
    id && validAppointmentManageToken(id, token)
      ? await prisma.appointment.findUnique({
          where: { id },
          include: {
            practitioner: { select: { name: true, publicName: true } },
            serviceOption: { select: { key: true } },
            service: {
              include: {
                contents: {
                  where: { locale, status: "PUBLISHED" },
                  take: 1,
                  select: { h1: true },
                },
              },
            },
          },
        })
      : null;

  if (!appointment)
    return (
      <Panel
        tone="warning"
        title={t.invalidTitle}
        body={t.invalidBody}
        locale={locale}
        bookLabel={t.book}
      />
    );

  const cancelled = appointment.status === "CANCELLED";
  const past = appointment.start <= new Date();
  const editable = !cancelled && !past && appointment.status !== "COMPLETED";

  if (cancelled)
    return (
      <Panel
        tone="ok"
        title={t.cancelledTitle}
        body={done === "cancelled" ? t.doneCancelled : t.cancelledBody}
        locale={locale}
        bookLabel={t.book}
      />
    );

  const title = appointment.service.contents[0]?.h1 ?? appointment.service.slug;
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Helsinki",
  });
  const notice =
    done === "rescheduled"
      ? { tone: "ok" as const, text: t.doneRescheduled }
      : error === "slot_taken"
        ? { tone: "warning" as const, text: t.errorSlotTaken }
        : error === "invalid_time"
          ? { tone: "warning" as const, text: t.errorInvalidTime }
          : error
            ? { tone: "warning" as const, text: t.errorInvalid }
            : null;

  const details: Array<[string, string]> = [
    [t.service, title],
    ...(appointment.procedureTitle
      ? ([[t.procedure, appointment.procedureTitle]] as Array<[string, string]>)
      : []),
    [t.time, dateTime.format(appointment.start)],
    [
      t.specialist,
      appointment.practitioner.publicName ??
        appointment.practitioner.name.split(/\s+/)[0],
    ],
    [
      t.duration,
      `${Math.round((appointment.end.getTime() - appointment.start.getTime()) / 60000)} ${t.minutes}`,
    ],
    [t.reference, appointment.id.slice(-8).toUpperCase()],
  ];

  return (
    <section className="bg-page py-[clamp(36px,6vw,82px)]">
      <Container className="max-w-[760px]">
        <p className="font-sans text-xs tracking-[.16em] text-muted uppercase">
          {t.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-[clamp(34px,5vw,54px)] font-medium text-ink">
          {t.title}
        </h1>
        {editable ? (
          <p className="mt-3 font-sans text-sm text-body">{t.lead}</p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className={`mt-5 flex items-start gap-2 rounded border px-4 py-3 font-sans text-sm ${notice.tone === "ok" ? "border-line-btn bg-btn-fill" : "border-line-card bg-card"}`}
          >
            {notice.tone === "ok" ? (
              <CheckCircle size={19} weight="thin" className="text-accent" />
            ) : (
              <WarningCircle size={19} weight="thin" className="text-accent" />
            )}
            {notice.text}
          </p>
        ) : null}

        <article className="mt-6 rounded-[8px] border border-line-card bg-card p-[clamp(18px,3vw,26px)] shadow-card">
          <CalendarCheck size={26} weight="thin" className="text-accent" />
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,150px)_1fr]">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-sans text-xs tracking-[.08em] text-muted uppercase">
                  {label}
                </dt>
                <dd className="font-sans text-base text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 grid gap-2 border-t border-line-hair pt-4 font-sans text-sm text-body">
            <p>
              <strong>{t.clinic}:</strong> {CONTACT.address.street},{" "}
              {CONTACT.address.postalCode} {CONTACT.address.city} ·{" "}
              {CONTACT.phone}
            </p>
            <p>{t.paidAtClinic}</p>
            <p className="text-muted">
              <strong>{policy.title}:</strong> {cancellationPolicyText(locale)}{" "}
              <a
                href={policyHref}
                className="font-medium text-accent underline decoration-accent/45 underline-offset-4"
              >
                {policy.linkLabel}
              </a>
            </p>
          </div>

          {editable ? (
            <ManageAppointment
              token={token}
              serviceSlug={appointment.service.slug}
              optionKey={appointment.serviceOption?.key}
              locale={locale}
              copy={t.manage}
            />
          ) : (
            <p className="mt-5 font-sans text-sm text-muted">
              {t.pastTitle}: {t.pastBody}
            </p>
          )}
        </article>
      </Container>
    </section>
  );
}

function Panel({
  tone,
  title,
  body,
  locale,
  bookLabel,
}: {
  tone: "ok" | "warning";
  title: string;
  body: string;
  locale: Locale;
  bookLabel: string;
}) {
  const Icon = tone === "ok" ? CheckCircle : WarningCircle;
  return (
    <section className="bg-page py-[clamp(60px,8vw,120px)]">
      <Container className="max-w-[640px]">
        <div className="rounded-[8px] border border-line-card bg-card p-[clamp(24px,4vw,44px)] text-center shadow-card">
          <Icon size={48} weight="thin" className="mx-auto text-accent" />
          <h1 className="mt-4 font-display text-[clamp(28px,4vw,40px)] font-medium text-ink">
            {title}
          </h1>
          <p className="mt-3 font-sans text-sm leading-7 text-body">{body}</p>
          <p className="mt-3 font-sans text-sm text-muted">{CONTACT.phone}</p>
          <a
            href={localizedPath(PUBLIC_PATHS.booking, locale)}
            className="mt-6 inline-flex min-h-11 items-center rounded bg-accent px-5 font-sans text-xs font-medium tracking-[.12em] text-page uppercase"
          >
            {bookLabel}
          </a>
        </div>
      </Container>
    </section>
  );
}
