"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  ChatText,
  EnvelopeSimple,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { smsSegments } from "@/lib/sms";
import type { ConversationMessage } from "@/lib/chat-handoff";

type Locale = "fi" | "en" | "ru";
type SessionSummary = {
  id: string;
  locale: Locale;
  status: "OPEN" | "RESOLVED";
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  updatedAt: string;
};
type Delivery = {
  id: string;
  channel: "EMAIL" | "SMS";
  recipient: string;
  subject: string | null;
  body: string;
  actor: string;
  createdAt: string;
  attempts: Array<{
    status: "ACCEPTED" | "FAILED" | "SKIPPED";
    provider: string | null;
    errorDetail: string | null;
    attemptedAt: string;
  }>;
};
type Detail = SessionSummary & {
  messages: ConversationMessage[];
  outboundMessages: Delivery[];
};

const copy = {
  en: {
    title: "Conversations",
    intro: "Reply to customer handoffs by email, SMS, and secure website chat.",
    open: "Open",
    resolved: "Resolved",
    refresh: "Refresh",
    empty: "No conversations found.",
    select: "Select a conversation.",
    name: "Name",
    email: "Email",
    phone: "Phone",
    notProvided: "Not provided",
    transcript: "Conversation",
    delivery: "Delivery history",
    noDelivery: "No replies sent yet.",
    reply: "Send a reply",
    subject: "Subject (optional)",
    message: "Message",
    send: "Send reply",
    resolve: "Resolve",
    reopen: "Reopen",
    archive: "Archive",
    retry: "Retry",
    websiteChat: "Website chat",
    alwaysEnabled: "Always enabled",
    unavailable: "Unavailable",
    sent: "Reply published to the conversation.",
    deliveryFailed:
      "External delivery was not accepted; review the delivery history.",
    error: "The reply could not be published.",
    validation: "Enter a message before sending.",
    emailUnavailable: "This conversation has no email address.",
    smsUnavailable: "This conversation has no phone number.",
    smsTooLong: "The SMS is too long. Use no more than 3 segments.",
    segments: "SMS segments",
    customer: "Customer",
    assistant: "Mone assistant",
  },
  fi: {
    title: "Keskustelut",
    intro:
      "Vastaa asiakkaiden yhteydenottoihin sähköpostilla, SMS:llä ja suojatussa verkkokeskustelussa.",
    open: "Avoimet",
    resolved: "Ratkaistut",
    refresh: "Päivitä",
    empty: "Keskusteluja ei löytynyt.",
    select: "Valitse keskustelu.",
    name: "Nimi",
    email: "Sähköposti",
    phone: "Puhelin",
    notProvided: "Ei annettu",
    transcript: "Keskustelu",
    delivery: "Toimitushistoria",
    noDelivery: "Vastauksia ei ole vielä lähetetty.",
    reply: "Lähetä vastaus",
    subject: "Aihe (valinnainen)",
    message: "Viesti",
    send: "Lähetä vastaus",
    resolve: "Ratkaise",
    reopen: "Avaa uudelleen",
    archive: "Arkistoi",
    retry: "Yritä uudelleen",
    websiteChat: "Verkkokeskustelu",
    alwaysEnabled: "Aina käytössä",
    unavailable: "Ei käytettävissä",
    sent: "Vastaus julkaistiin keskusteluun.",
    deliveryFailed: "Ulkoinen toimitus epäonnistui; tarkista toimitushistoria.",
    error: "Vastausta ei voitu julkaista.",
    validation: "Kirjoita viesti ennen lähettämistä.",
    emailUnavailable: "Keskustelulle ei ole sähköpostiosoitetta.",
    smsUnavailable: "Keskustelulle ei ole puhelinnumeroa.",
    smsTooLong: "SMS on liian pitkä. Käytä enintään kolmea SMS-osaa.",
    segments: "SMS-osat",
    customer: "Asiakas",
    assistant: "Mone-avustaja",
  },
  ru: {
    title: "Диалоги",
    intro: "Отвечайте клиентам по email, SMS и в защищённом чате сайта.",
    open: "Открытые",
    resolved: "Закрытые",
    refresh: "Обновить",
    empty: "Диалоги не найдены.",
    select: "Выберите диалог.",
    name: "Имя",
    email: "Email",
    phone: "Телефон",
    notProvided: "Не указано",
    transcript: "Диалог",
    delivery: "История доставки",
    noDelivery: "Ответов пока нет.",
    reply: "Отправить ответ",
    subject: "Тема (необязательно)",
    message: "Сообщение",
    send: "Отправить ответ",
    resolve: "Закрыть",
    reopen: "Открыть снова",
    archive: "Архивировать",
    retry: "Повторить",
    websiteChat: "Чат на сайте",
    alwaysEnabled: "Всегда включён",
    unavailable: "Недоступно",
    sent: "Ответ опубликован в диалоге.",
    deliveryFailed:
      "Внешняя доставка не подтверждена; проверьте историю доставки.",
    error: "Не удалось опубликовать ответ.",
    validation: "Введите сообщение перед отправкой.",
    emailUnavailable: "Для этого диалога не указан email.",
    smsUnavailable: "Для этого диалога не указан номер телефона.",
    smsTooLong: "SMS слишком длинное. Используйте не более 3 сегментов.",
    segments: "SMS-сегменты",
    customer: "Клиент",
    assistant: "Ассистент Mone",
  },
} as const;

export function ConversationWorkspace({
  locale,
  initialSessionId,
}: {
  locale: Locale;
  initialSessionId?: string;
}) {
  const t = copy[locale];
  const [status, setStatus] = useState<"OPEN" | "RESOLVED">("OPEN");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState(initialSessionId ?? "");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [canArchive, setCanArchive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return setDetail(null);
    const response = await fetch(
      `/api/internal/chat/${encodeURIComponent(id)}`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) return setDetail(null);
    const payload = (await response.json()) as {
      session: Detail;
      canArchive: boolean;
    };
    setDetail(payload.session);
    setCanArchive(payload.canArchive);
  }, []);

  const loadSessions = useCallback(async () => {
    const response = await fetch(`/api/internal/chat?status=${status}`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      sessions: SessionSummary[];
      canArchive: boolean;
    };
    setSessions(payload.sessions);
    setCanArchive(payload.canArchive);
    setSelectedId((current) =>
      current && payload.sessions.some((session) => session.id === current)
        ? current
        : (payload.sessions[0]?.id ?? ""),
    );
    return payload.sessions;
  }, [status]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      await loadSessions();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadSessions]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetail(selectedId), 0);
    return () => window.clearTimeout(timer);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      void (async () => {
        const next = await loadSessions();
        const selected = next.find((session) => session.id === selectedId);
        if (selected && selected.updatedAt !== detail?.updatedAt) {
          await loadDetail(selected.id);
        }
      })();
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [detail?.updatedAt, loadDetail, loadSessions, selectedId]);

  async function updateStatus(intent: "resolve" | "reopen" | "archive") {
    if (!detail) return;
    const response = await fetch(`/api/internal/chat/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent }),
    });
    if (!response.ok) return setNotice(t.error);
    setNotice(null);
    await loadSessions();
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium text-ink">
            {t.title}
          </h2>
          <p className="mt-1 max-w-170 font-sans text-[14px] text-muted">
            {t.intro}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSessions()}
          className={secondaryButton}
        >
          <ArrowClockwise size={17} /> {t.refresh}
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        {(["OPEN", "RESOLVED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus(value);
              setSelectedId("");
            }}
            className={status === value ? primaryButton : secondaryButton}
          >
            {value === "OPEN" ? t.open : t.resolved}
          </button>
        ))}
      </div>
      <div className="mt-3.5 grid min-h-130 overflow-hidden rounded-lg border border-line-card bg-card lg:grid-cols-[300px_1fr]">
        <aside className="max-h-180 overflow-y-auto border-b border-line-card lg:border-r lg:border-b-0">
          {loading ? (
            <p className="p-4 font-sans text-[14px] text-muted">…</p>
          ) : sessions.length ? (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setSelectedId(session.id);
                  setNotice(null);
                }}
                className={cn(
                  "block w-full border-b border-line-hair px-3.5 py-3.25 text-left font-sans",
                  selectedId === session.id ? "bg-btn-fill" : "bg-card",
                )}
              >
                <strong className="block truncate text-[14px] text-ink">
                  {session.contactName ||
                    session.contactEmail ||
                    session.id.slice(-8)}
                </strong>
                <small className="mt-1 block text-[11px] text-muted">
                  {session.locale.toUpperCase()} ·{" "}
                  {formatDate(session.updatedAt, locale)}
                </small>
              </button>
            ))
          ) : (
            <p className="p-4 font-sans text-[14px] text-muted">{t.empty}</p>
          )}
        </aside>
        <div className="min-w-0 p-[clamp(14px,3vw,24px)]">
          {detail ? (
            <>
              <dl className="grid gap-2.5 font-sans text-label sm:grid-cols-3">
                <Contact
                  label={t.name}
                  value={detail.contactName}
                  empty={t.notProvided}
                />
                <Contact
                  label={t.email}
                  value={detail.contactEmail}
                  empty={t.notProvided}
                />
                <Contact
                  label={t.phone}
                  value={detail.contactPhone}
                  empty={t.notProvided}
                />
              </dl>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void updateStatus(
                      detail.status === "OPEN" ? "resolve" : "reopen",
                    )
                  }
                  className={primaryButton}
                >
                  {detail.status === "OPEN" ? t.resolve : t.reopen}
                </button>
                {canArchive ? (
                  <button
                    type="button"
                    onClick={() => void updateStatus("archive")}
                    className={secondaryButton}
                  >
                    {t.archive}
                  </button>
                ) : null}
              </div>
              <Transcript messages={detail.messages} t={t} />
              <ReplyComposer
                key={detail.id}
                detail={detail}
                t={t}
                onNotice={setNotice}
                onSent={() => loadDetail(detail.id)}
              />
              <DeliveryHistory
                detail={detail}
                t={t}
                onRefresh={() => loadDetail(detail.id)}
              />
              {notice ? (
                <p
                  role="status"
                  className="mt-3 rounded border border-line-btn bg-btn-fill p-2.5 font-sans text-label"
                >
                  {notice}
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-sans text-[14px] text-muted">{t.select}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Transcript({
  messages,
  t,
}: {
  messages: ConversationMessage[];
  t: (typeof copy)[Locale];
}) {
  return (
    <section className="mt-5.5">
      <h3 className="font-sans text-label font-semibold tracking-[.08em] uppercase">
        {t.transcript}
      </h3>
      <div className="mt-2.5 grid max-h-105 gap-2.25 overflow-y-auto rounded-md border border-line-hair bg-page p-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}:${message.outboundMessageId ?? index}`}
            className={cn(
              "max-w-[88%] rounded-[7px] border px-2.75 py-2.25 font-sans text-label",
              message.role === "user"
                ? "ml-auto border-accent bg-accent text-page"
                : "mr-auto border-line-card bg-card text-body",
            )}
          >
            <small className="block font-semibold tracking-wider uppercase opacity-75">
              {message.role === "user"
                ? t.customer
                : message.role === "operator"
                  ? message.senderName || "Mone Beauty Clinic"
                  : t.assistant}
            </small>
            <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReplyComposer({
  detail,
  t,
  onNotice,
  onSent,
}: {
  detail: Detail;
  t: (typeof copy)[Locale];
  onNotice: (value: string | null) => void;
  onSent: () => Promise<void>;
}) {
  const [channels, setChannels] = useState<Array<"EMAIL" | "SMS">>(() =>
    detail.contactEmail ? ["EMAIL"] : [],
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const sms = useMemo(() => smsSegments(body), [body]);
  const emailSelected = channels.includes("EMAIL");
  const smsSelected = channels.includes("SMS");
  function toggleChannel(channel: "EMAIL" | "SMS") {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((value) => value !== channel)
        : [...current, channel],
    );
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    onNotice(null);
    const response = await fetch(`/api/internal/chat/${detail.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels, subject, body }),
    });
    setSending(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      const errors: Record<string, string> = {
        validation: t.validation,
        email_unavailable: t.emailUnavailable,
        sms_unavailable: t.smsUnavailable,
        sms_too_long: t.smsTooLong,
      };
      return onNotice(errors[payload?.error ?? ""] ?? t.error);
    }
    const payload = (await response.json()) as {
      chat?: { status?: string };
      deliveries?: Array<{ channel: "EMAIL" | "SMS"; status: string }>;
    };
    setBody("");
    setSubject("");
    onNotice(
      payload.deliveries?.every((delivery) => delivery.status === "accepted")
        ? t.sent
        : `${t.sent} ${t.deliveryFailed}`,
    );
    await onSent();
  }
  return (
    <section className="mt-5.5 rounded-md border border-line-card bg-page p-3.5">
      <h3 className="font-sans text-label font-semibold tracking-[.08em] uppercase">
        {t.reply}
      </h3>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <span
          role="status"
          aria-label={`${t.websiteChat}: ${t.alwaysEnabled}`}
          className={primaryButton}
        >
          <ChatText size={16} /> {t.websiteChat} · {t.alwaysEnabled}
        </span>
        {(["EMAIL", "SMS"] as const).map((value) => {
          const available =
            value === "EMAIL"
              ? Boolean(detail.contactEmail)
              : Boolean(detail.contactPhone);
          const selected = channels.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              disabled={!available}
              onClick={() => toggleChannel(value)}
              className={selected ? primaryButton : secondaryButton}
            >
              {value === "EMAIL" ? (
                <EnvelopeSimple size={16} />
              ) : (
                <ChatText size={16} />
              )}{" "}
              {value} {!available ? `· ${t.unavailable}` : ""}
            </button>
          );
        })}
      </div>
      <form
        onSubmit={(event) => void submit(event)}
        className="mt-3 grid gap-2.5"
      >
        {emailSelected ? (
          <>
            <input
              readOnly
              value={detail.contactEmail ?? ""}
              className={input}
            />
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={160}
              placeholder={t.subject}
              className={input}
            />
          </>
        ) : null}
        {smsSelected ? (
          <input readOnly value={detail.contactPhone ?? ""} className={input} />
        ) : null}
        <textarea
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          maxLength={5000}
          placeholder={t.message}
          className={`${input} py-2.5`}
        />
        {smsSelected ? (
          <p className="font-sans text-[11px] text-muted">
            {t.segments}: {sms.segments}/3
          </p>
        ) : null}
        <button
          disabled={
            sending || !body.trim() || (smsSelected && sms.segments > 3)
          }
          className={primaryButton}
        >
          <PaperPlaneTilt size={16} /> {t.send}
        </button>
      </form>
    </section>
  );
}

function DeliveryHistory({
  detail,
  t,
  onRefresh,
}: {
  detail: Detail;
  t: (typeof copy)[Locale];
  onRefresh: () => Promise<void>;
}) {
  async function retry(messageId: string) {
    await fetch(`/api/internal/chat/${detail.id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    await onRefresh();
  }
  return (
    <section className="mt-5.5">
      <h3 className="font-sans text-label font-semibold tracking-[.08em] uppercase">
        {t.delivery}
      </h3>
      <div className="mt-2.5 grid gap-2">
        {detail.outboundMessages.length ? (
          detail.outboundMessages.map((message) => {
            const accepted = message.attempts.some(
              (attempt) => attempt.status === "ACCEPTED",
            );
            const latest = message.attempts[0];
            return (
              <article
                key={message.id}
                className="rounded-md border border-line-hair bg-page p-3 font-sans text-meta"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>
                    {message.channel} · {latest?.status ?? "SKIPPED"}
                  </strong>
                  <span className="text-muted">
                    {formatDate(message.createdAt, detail.locale)}
                  </span>
                </div>
                {message.subject ? (
                  <strong className="mt-2 block">{message.subject}</strong>
                ) : null}
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-body">
                  {message.body}
                </p>
                <p className="mt-2 text-muted">
                  {message.recipient}
                  {latest?.provider ? ` · ${latest.provider}` : ""}
                </p>
                {!accepted ? (
                  <button
                    type="button"
                    onClick={() => void retry(message.id)}
                    className={`${secondaryButton} mt-2`}
                  >
                    {t.retry}
                  </button>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="font-sans text-label text-muted">{t.noDelivery}</p>
        )}
      </div>
    </section>
  );
}

function Contact({
  label,
  value,
  empty,
}: {
  label: string;
  value: string | null;
  empty: string;
}) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 text-ink">{value || empty}</dd>
    </div>
  );
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const primaryButton =
  "inline-flex min-h-[42px] w-fit items-center justify-center gap-1.75 rounded-[4px] bg-accent px-3.5 font-sans text-meta font-medium tracking-[.06em] text-page uppercase disabled:opacity-45";
const secondaryButton =
  "inline-flex min-h-[42px] w-fit items-center justify-center gap-1.75 rounded-[4px] border border-line-btn bg-card px-3.5 font-sans text-meta font-medium tracking-[.06em] text-ink uppercase disabled:opacity-45";
const input =
  "min-h-11 w-full rounded-[4px] border border-line-btn bg-card px-3 font-sans text-[14px] text-ink outline-none focus:border-accent";
