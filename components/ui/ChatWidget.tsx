"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  ChatCircleDots,
  EnvelopeSimple,
  PaperPlaneTilt,
  X,
} from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { CONTACT } from "@/content/site";
import { PUBLIC_PATHS } from "@/lib/public-routes";

type ChatMessage = {
  role: "user" | "assistant" | "operator";
  content: string;
  senderName?: string;
  channel?: "EMAIL" | "SMS";
  outboundMessageId?: string;
  sources?: { title: string; href: string }[];
};

const HUMAN_CHAT_STORAGE_KEY = "mone-human-chat-v1";

export function ChatWidget() {
  const t = useTranslations("Chat");
  const locale = useLocale();
  const currentPath = usePathname();
  const nameRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatToken, setChatToken] = useState<string | null>(null);
  const [humanMode, setHumanMode] = useState(false);
  const [input, setInput] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [booking, setBooking] = useState<{
    serviceKey: string;
    href: string;
  } | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffSent, setHandoffSent] = useState(false);
  const [handoff, setHandoff] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const panelTitle = useMemo(() => t("title"), [t]);
  const handoffReady = Boolean(
    consent &&
    handoff.name.trim() &&
    handoff.message.trim() &&
    (handoff.email.trim() || handoff.phone.trim()),
  );

  useEffect(() => {
    if (handoffOpen) nameRef.current?.focus();
  }, [handoffOpen]);

  const loadHumanConversation = useCallback(
    async (id: string, token: string) => {
      const response = await fetch(
        `/api/chat/session?id=${encodeURIComponent(id)}`,
        {
          cache: "no-store",
          headers: { "X-Chat-Token": token },
        },
      );
      if (!response.ok) {
        if (response.status === 403) {
          window.sessionStorage.removeItem(HUMAN_CHAT_STORAGE_KEY);
          setHumanMode(false);
          setChatToken(null);
        }
        return;
      }
      const payload = (await response.json()) as { messages?: ChatMessage[] };
      if (Array.isArray(payload.messages)) setMessages(payload.messages);
    },
    [],
  );

  useEffect(() => {
    let timer: number | undefined;
    try {
      const stored = JSON.parse(
        window.sessionStorage.getItem(HUMAN_CHAT_STORAGE_KEY) ?? "null",
      ) as { id?: unknown; token?: unknown } | null;
      if (typeof stored?.id !== "string" || typeof stored.token !== "string")
        return;
      timer = window.setTimeout(() => {
        setSessionId(stored.id as string);
        setChatToken(stored.token as string);
        setHumanMode(true);
        void loadHumanConversation(stored.id as string, stored.token as string);
      }, 0);
    } catch {
      window.sessionStorage.removeItem(HUMAN_CHAT_STORAGE_KEY);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [loadHumanConversation]);

  useEffect(() => {
    if (!humanMode || !sessionId || !chatToken) return;
    const refresh = () => {
      if (!document.hidden) void loadHumanConversation(sessionId, chatToken);
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, open ? 15_000 : 30_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [chatToken, humanMode, loadHumanConversation, open, sessionId]);

  function openHandoff(prefill?: string) {
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content;
    const message = prefill?.trim() || latestUserMessage || "";
    setHandoff((current) => ({
      ...current,
      message: current.message || message,
    }));
    setHandoffSent(false);
    setHandoffOpen(true);
  }

  async function sendMessage(retryMessage?: string) {
    const text = retryMessage?.trim() || input.trim();
    if (!text || loading) return;
    if (humanMode && sessionId && chatToken) {
      await sendHumanMessage(text, sessionId, chatToken);
      return;
    }
    const retrying = Boolean(retryMessage);
    const priorMessages =
      retrying &&
      messages.at(-1)?.role === "user" &&
      messages.at(-1)?.content === text
        ? messages.slice(0, -1)
        : messages;
    if (!retrying) setInput("");
    setError(null);
    setUnavailable(false);
    setBooking(null);
    const nextMessages = [
      ...priorMessages,
      { role: "user" as const, content: text },
    ];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          locale,
          message: text,
          currentPath,
          history: priorMessages.map(({ role, content }) => ({
            role,
            content,
          })),
          consentGdpr: consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "assistant_unavailable") {
          setUnavailable(true);
          setFailedMessage(text);
          return;
        }
        throw new Error("chat_failed");
      }
      if (data.kind === "handoff") {
        setFailedMessage(null);
        openHandoff(text);
        return;
      }
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: String(data.answer ?? ""),
          sources: Array.isArray(data.sources) ? data.sources : [],
        },
      ]);
      setSessionId(data.sessionId ?? sessionId);
      setBooking(data.booking ?? null);
      setFailedMessage(null);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  async function sendHumanMessage(text: string, id: string, token: string) {
    setInput("");
    setError(null);
    setLoading(true);
    const previous = messages;
    setMessages([...messages, { role: "user", content: text }]);
    try {
      const response = await fetch(
        `/api/chat/session?id=${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Chat-Token": token,
          },
          body: JSON.stringify({ message: text }),
        },
      );
      if (!response.ok) throw new Error("human_chat_failed");
      await loadHumanConversation(id, token);
    } catch {
      setMessages(previous);
      setInput(text);
      setError(t("handoffError"));
    } finally {
      setLoading(false);
    }
  }

  async function sendHandoff() {
    setError(null);
    if (!handoffReady) {
      setError(t("handoffValidation"));
      return;
    }
    try {
      const res = await fetch("/api/chat/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          locale,
          ...handoff,
          history: messages.map(({ role, content }) => ({ role, content })),
          consentGdpr: consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const validationErrors = new Set([
          "consent_required",
          "name_required",
          "message_required",
          "contact_required",
          "email_invalid",
          "phone_invalid",
        ]);
        if (validationErrors.has(String(data.error ?? ""))) {
          setError(t("handoffValidation"));
          return;
        }
        throw new Error("handoff_failed");
      }
      setSessionId(data.id ?? sessionId);
      setChatToken(data.token ?? null);
      if (data.id && data.token) {
        window.sessionStorage.setItem(
          HUMAN_CHAT_STORAGE_KEY,
          JSON.stringify({ id: data.id, token: data.token }),
        );
        setHumanMode(true);
        await loadHumanConversation(data.id, data.token);
      }
      setHandoffSent(true);
      setHandoffOpen(false);
      setUnavailable(false);
    } catch {
      setError(t("handoffError"));
    }
  }

  return (
    <div className="fixed right-[14px] bottom-[14px] z-[60] flex max-w-[calc(100vw-28px)] flex-col items-end gap-[12px] sm:right-[22px] sm:bottom-[22px]">
      {open ? (
        <section className="flex h-[min(680px,calc(100vh-100px))] w-[min(390px,calc(100vw-28px))] flex-col overflow-hidden rounded-[14px] border border-line-card bg-page shadow-[var(--shadow-bubble)]">
          <header className="flex items-center justify-between gap-[12px] border-b border-line-hair bg-card px-[16px] py-[13px]">
            <div>
              <div className="font-display text-[20px] font-semibold text-ink">
                {panelTitle}
              </div>
              <p className="font-sans text-label text-muted">{t("subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="grid h-[38px] w-[38px] place-items-center rounded-full border border-line-btn text-ink"
            >
              <X size={18} weight="thin" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-[14px] py-[14px]">
            {messages.length === 0 ? (
              <div className="rounded-[8px] border border-line-card bg-card p-[14px] font-sans text-compact leading-[1.6] text-body">
                {t("welcome")}
              </div>
            ) : null}
            <div className="grid gap-[10px]">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "max-w-[88%] rounded-[10px] px-[12px] py-[10px] font-sans text-compact leading-[1.55]",
                    message.role === "user"
                      ? "ml-auto bg-accent text-page"
                      : "mr-auto border border-line-card bg-card text-body",
                  )}
                >
                  {message.role === "operator" ? (
                    <small className="mb-1 block text-meta font-semibold tracking-[.06em] text-muted uppercase">
                      {message.senderName || t("operatorFallback")}
                    </small>
                  ) : null}
                  <p className="whitespace-pre-line">{message.content}</p>
                  {message.role === "assistant" && message.sources?.length ? (
                    <div className="mt-[8px] border-t border-line-hair pt-[7px]">
                      <div className="mb-[4px] text-meta tracking-[.1em] text-muted uppercase">
                        {t("sources")}
                      </div>
                      <ul className="grid gap-[3px]">
                        {message.sources.map((source) => (
                          <li key={source.href}>
                            <Link
                              href={source.href}
                              className="text-label text-accent underline decoration-line-btn underline-offset-2"
                            >
                              {source.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
              {loading ? (
                <div className="mr-auto rounded-[10px] border border-line-card bg-card px-[12px] py-[10px] font-sans text-compact text-muted">
                  {t("thinking")}
                </div>
              ) : null}
            </div>
            {unavailable ? (
              <div
                role="alert"
                className="mt-[12px] rounded-[8px] border border-line-btn bg-btn-fill p-[12px]"
              >
                <p className="font-sans text-[14px] leading-[1.55] text-ink">
                  {t("assistantUnavailable")}
                </p>
                <div className="mt-[10px] flex flex-wrap gap-[8px]">
                  <button
                    type="button"
                    onClick={() =>
                      failedMessage && void sendMessage(failedMessage)
                    }
                    disabled={!failedMessage || loading}
                    className="min-h-[40px] rounded-[4px] bg-accent px-[12px] font-sans text-meta tracking-[.1em] text-page uppercase disabled:opacity-50"
                  >
                    {t("retry")}
                  </button>
                  <Link
                    href={PUBLIC_PATHS.booking}
                    className="inline-flex min-h-[40px] items-center rounded-[4px] border border-line-btn px-[12px] font-sans text-meta tracking-[.1em] text-ink uppercase"
                  >
                    {t("bookOnline")}
                  </Link>
                  <a
                    href={CONTACT.emailHref}
                    className="inline-flex min-h-[40px] items-center rounded-[4px] border border-line-btn px-[12px] font-sans text-meta tracking-[.1em] text-ink uppercase"
                  >
                    {t("contactClinic")}
                  </a>
                  <button
                    type="button"
                    onClick={() => openHandoff(failedMessage ?? undefined)}
                    className="inline-flex min-h-[40px] items-center rounded-[4px] border border-line-btn px-[12px] font-sans text-meta tracking-[.1em] text-ink uppercase"
                  >
                    {t("humanFollowUp")}
                  </button>
                </div>
              </div>
            ) : null}
            {booking ? (
              <Link
                href={{
                  pathname: PUBLIC_PATHS.booking,
                  query: { service: booking.serviceKey },
                }}
                className="mt-[12px] inline-flex min-h-[44px] items-center gap-[8px] rounded-[4px] bg-accent px-[14px] font-sans text-meta tracking-[.12em] text-page uppercase"
              >
                {t("book")} <ArrowRight size={14} weight="thin" />
              </Link>
            ) : null}
            {handoffSent ? (
              <p className="mt-[12px] rounded-[4px] border border-line-btn bg-btn-fill px-[12px] py-[9px] font-sans text-[14px] text-ink">
                {t("handoffSent")}
              </p>
            ) : null}
            {humanMode ? (
              <p className="mt-[12px] rounded-[4px] border border-line-btn bg-btn-fill px-[12px] py-[9px] font-sans text-[13px] text-ink">
                {t("humanConnected")}
              </p>
            ) : null}
            {error ? (
              <p className="mt-[12px] rounded-[4px] border border-line-btn bg-btn-fill px-[12px] py-[9px] font-sans text-[14px] text-ink">
                {error}
              </p>
            ) : null}
          </div>

          {handoffOpen ? (
            <div className="border-t border-line-hair bg-card px-[14px] py-[12px]">
              <div className="grid gap-[8px]">
                <input
                  ref={nameRef}
                  value={handoff.name}
                  onChange={(e) =>
                    setHandoff({ ...handoff, name: e.target.value })
                  }
                  placeholder={t("fields.name")}
                  className={inputCls}
                />
                <input
                  value={handoff.email}
                  onChange={(e) =>
                    setHandoff({ ...handoff, email: e.target.value })
                  }
                  placeholder={t("fields.email")}
                  className={inputCls}
                />
                <input
                  value={handoff.phone}
                  onChange={(e) =>
                    setHandoff({ ...handoff, phone: e.target.value })
                  }
                  placeholder={t("fields.phone")}
                  className={inputCls}
                />
                <textarea
                  value={handoff.message}
                  onChange={(e) =>
                    setHandoff({ ...handoff, message: e.target.value })
                  }
                  placeholder={t("fields.message")}
                  rows={2}
                  className={inputCls}
                />
                <label className="flex items-start gap-[8px] font-sans text-[14px] leading-[1.5] text-body">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-[2px] h-[16px] w-[16px] accent-[var(--accent)]"
                  />
                  <span>
                    {t.rich("consent", {
                      link: (chunks) => (
                        <Link
                          href={PUBLIC_PATHS.privacy}
                          target="_blank"
                          className="underline underline-offset-4 hover:text-accent"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
              </div>
              <div className="mt-[10px] flex gap-[8px]">
                <button
                  type="button"
                  onClick={() => void sendHandoff()}
                  disabled={!handoffReady}
                  className="min-h-[44px] flex-1 rounded-[4px] bg-accent px-[12px] font-sans text-meta tracking-[.12em] text-page uppercase disabled:opacity-50"
                >
                  {t("sendHandoff")}
                </button>
                <button
                  type="button"
                  onClick={() => setHandoffOpen(false)}
                  className="min-h-[44px] rounded-[4px] border border-line-btn px-[12px] font-sans text-meta tracking-[.12em] text-ink uppercase"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <footer className="border-t border-line-hair bg-card px-[14px] py-[12px]">
              {!humanMode ? (
                <label className="mb-[10px] flex items-start gap-[8px] font-sans text-[14px] leading-[1.5] text-body">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-[2px] h-[16px] w-[16px] accent-[var(--accent)]"
                  />
                  <span>
                    {t.rich("consent", {
                      link: (chunks) => (
                        <Link
                          href={PUBLIC_PATHS.privacy}
                          target="_blank"
                          className="underline underline-offset-4 hover:text-accent"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
              ) : null}
              <div className="flex gap-[8px]">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={
                    humanMode ? t("humanPlaceholder") : t("placeholder")
                  }
                  className="min-h-[44px] flex-1 rounded-[4px] border border-line-btn bg-page px-[12px] font-sans text-copy text-ink outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || loading}
                  aria-label={t("send")}
                  className="grid h-[44px] w-[44px] place-items-center rounded-[4px] bg-accent text-page disabled:opacity-50"
                >
                  <PaperPlaneTilt size={18} weight="thin" />
                </button>
              </div>
              {!humanMode ? (
                <button
                  type="button"
                  onClick={() => openHandoff()}
                  className="mt-[10px] inline-flex min-h-[40px] items-center gap-[7px] font-sans text-label text-accent"
                >
                  <EnvelopeSimple size={15} weight="thin" />
                  {t("handoff")}
                </button>
              ) : null}
            </footer>
          )}
        </section>
      ) : (
        <div className="hidden rounded-[14px] bg-page px-[16px] py-[12px] shadow-[var(--shadow-bubble)] sm:block">
          <div className="font-sans text-label font-medium text-ink">
            {t("title")}
          </div>
          <div className="font-sans text-label font-normal text-muted">
            {t("subtitle")}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("open")}
        className="grid h-[58px] w-[58px] place-items-center rounded-full bg-accent text-page shadow-[var(--shadow-fab)]"
        style={
          open
            ? undefined
            : { animation: "monePulse 3.2s ease-in-out infinite" }
        }
      >
        {open ? (
          <X size={24} weight="thin" />
        ) : (
          <ChatCircleDots size={26} weight="thin" />
        )}
      </button>
    </div>
  );
}

const inputCls =
  "w-full rounded-[4px] border border-line-btn bg-page px-[10px] py-[9px] font-sans text-copy text-ink outline-none focus:border-accent";
