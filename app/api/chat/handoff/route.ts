import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { routing, type Locale } from "@/i18n/routing";
import { normalizeTranscript, validateHandoff } from "@/lib/chat-handoff";
import { createPublicChatToken } from "@/lib/chat-conversations";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const consentGdpr = payload.consentGdpr === true;
  if (!consentGdpr) return bad("consent_required");

  const sessionId = String(payload.sessionId ?? "").trim();
  const locale = routing.locales.includes(payload.locale as Locale)
    ? (payload.locale as Locale)
    : routing.defaultLocale;
  const validated = validateHandoff(payload);
  if (!validated.ok) return bad(validated.error);
  const { contactName, contactEmail, contactPhone, message } = validated.value;
  const submittedHistory = normalizeTranscript(payload.history);
  const publicAccess = createPublicChatToken();

  try {
    const saved = await prisma.$transaction(async (transaction) => {
      const existing = sessionId
        ? await transaction.chatSession.findUnique({
            where: { id: sessionId },
          })
        : null;
      const savedHistory = normalizeTranscript(existing?.messages);
      const baseMessages = submittedHistory.length
        ? submittedHistory
        : savedHistory;
      const lastMessage = baseMessages.at(-1);
      const messages = (
        lastMessage?.role === "user" && lastMessage.content === message
          ? [
              ...baseMessages.slice(0, -1),
              { role: "user", content: message, handoff: true },
            ]
          : [...baseMessages, { role: "user", content: message, handoff: true }]
      ).slice(-12) as Prisma.InputJsonValue;
      const chat = existing
        ? await transaction.chatSession.update({
            where: { id: existing.id },
            data: {
              locale,
              handoffRequested: true,
              status: "OPEN",
              contactName,
              contactEmail,
              contactPhone,
              messages,
              publicTokenHash: publicAccess.hash,
            },
            select: { id: true },
          })
        : await transaction.chatSession.create({
            data: {
              locale,
              messages,
              handoffRequested: true,
              status: "OPEN",
              contactName,
              contactEmail,
              contactPhone,
              publicTokenHash: publicAccess.hash,
            },
            select: { id: true },
          });
      await transaction.auditLog.create({
        data: {
          actor: contactEmail || contactPhone || "chat-customer",
          action: "chat_handoff_requested",
          entity: "ChatSession",
          entityId: chat.id,
        },
      });
      return chat;
    });

    return NextResponse.json({ id: saved.id, token: publicAccess.token });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
