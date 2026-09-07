import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { completeChat, hasChatProviderConfig, type ChatMessage } from "@/lib/ai";
import { routing, type Locale } from "@/i18n/routing";
import { detectBookingService, retrieveKnowledge } from "@/lib/chat-knowledge";
import { sourceLinks } from "@/lib/chat-reliability";
import { detectHumanHandoffIntent } from "@/lib/chat-intent";
import { PUBLIC_PATHS } from "@/lib/public-routes";

const MAX_MESSAGE = 1200;
const MAX_HISTORY = 12;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: unknown }).role;
      const content = String((item as { content?: unknown }).content ?? "")
        .trim()
        .slice(0, MAX_MESSAGE);
      if ((role !== "user" && role !== "assistant") || !content) return null;
      return { role, content };
    })
    .filter((item): item is ChatMessage => Boolean(item))
    .slice(-MAX_HISTORY);
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const locale = routing.locales.includes(payload.locale as Locale)
    ? (payload.locale as Locale)
    : routing.defaultLocale;
  const message = String(payload.message ?? "")
    .trim()
    .slice(0, MAX_MESSAGE);
  const consentGdpr = payload.consentGdpr === true;
  const history = normalizeMessages(payload.history);
  const sessionId = String(payload.sessionId ?? "").trim();
  const currentPath = String(payload.currentPath ?? "")
    .trim()
    .slice(0, 300);
  if (!message) return bad("message_required");

  if (detectHumanHandoffIntent(locale, message)) {
    return NextResponse.json({ kind: "handoff" });
  }

  let knowledge: Awaited<ReturnType<typeof retrieveKnowledge>>;
  let service: Awaited<ReturnType<typeof detectBookingService>>;
  try {
    [knowledge, service] = await Promise.all([
      retrieveKnowledge(locale, message, currentPath),
      detectBookingService(locale, message),
    ]);
  } catch {
    return NextResponse.json(
      { error: "assistant_unavailable", retryable: true },
      { status: 503 },
    );
  }

  if (!hasChatProviderConfig()) {
    return NextResponse.json(
      { error: "assistant_unavailable", retryable: true },
      { status: 503 },
    );
  }

  let answer: string;
  try {
    answer = await completeChat({
      locale,
      snippets: knowledge.snippets,
      messages: [...history, { role: "user", content: message }],
    });
  } catch {
    return NextResponse.json(
      { error: "assistant_unavailable", retryable: true },
      { status: 503 },
    );
  }
  const sources = knowledge.matched ? sourceLinks(knowledge.snippets) : [];

  let savedSessionId = sessionId || null;
  const nextMessages = [
    ...history,
    { role: "user" as const, content: message },
    { role: "assistant" as const, content: answer },
  ].slice(-MAX_HISTORY);

  if (consentGdpr) {
    try {
      const existing = savedSessionId
        ? await prisma.chatSession.findUnique({ where: { id: savedSessionId } })
        : null;
      const saved = existing
        ? await prisma.chatSession.update({
            where: { id: existing.id },
            data: { locale, messages: nextMessages },
            select: { id: true },
          })
        : await prisma.chatSession.create({
            data: { locale, messages: nextMessages },
            select: { id: true },
          });
      savedSessionId = saved.id;
    } catch {
      // The answer should still be delivered even if transcript persistence fails.
    }
  }

  return NextResponse.json({
    kind: "answer",
    answer,
    sessionId: savedSessionId,
    sources,
    booking: service
      ? {
          serviceKey: service.slug,
          href: `${PUBLIC_PATHS.booking}?service=${service.slug}`,
        }
      : null,
  });
}
