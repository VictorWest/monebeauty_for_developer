import { NextResponse, type NextRequest } from "next/server";
import {
  audit,
  authRateLimited,
  requestAuditContext,
  tokenHash,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appendConversationMessage } from "@/lib/chat-conversations";
import { normalizeConversationMessages } from "@/lib/chat-handoff";

function credentials(req: NextRequest) {
  return {
    id: String(req.nextUrl.searchParams.get("id") ?? "").trim(),
    token: String(req.headers.get("x-chat-token") ?? "").trim(),
  };
}

async function publicSession(req: NextRequest) {
  const { id, token } = credentials(req);
  if (!id || !token) return null;
  return prisma.chatSession.findFirst({
    where: {
      id,
      publicTokenHash: tokenHash(token),
      handoffRequested: true,
      anonymizedAt: null,
    },
    select: { id: true, status: true, messages: true, updatedAt: true },
  });
}

export async function GET(req: NextRequest) {
  const session = await publicSession(req);
  if (!session)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(
    {
      id: session.id,
      status: session.status,
      updatedAt: session.updatedAt.toISOString(),
      messages: normalizeConversationMessages(session.messages),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const { id } = credentials(req);
  const context = await requestAuditContext(req);
  const [blockedFailures, recentMessages] = await Promise.all([
    authRateLimited(
      id || "unknown",
      "chat_customer_message_denied",
      context.ipAddress,
    ),
    id
      ? prisma.auditLog.count({
          where: {
            actor: id,
            action: "chat_customer_message_added",
            at: { gte: new Date(Date.now() - 60_000) },
          },
        })
      : 0,
  ]);
  if (blockedFailures || recentMessages >= 20) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const session = await publicSession(req);
  if (!session) {
    await audit({
      actor: id || "unknown",
      action: "chat_customer_message_denied",
      outcome: "DENIED",
      entity: "ChatSession",
      entityId: id || null,
      ...context,
    });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const payload = (await req.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const content = String(payload?.message ?? "")
    .trim()
    .slice(0, 1200);
  if (!content)
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  await appendConversationMessage(session.id, {
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  });
  await prisma.chatSession.update({
    where: { id: session.id },
    data: { status: "OPEN", updatedAt: new Date() },
  });
  await audit({
    actor: session.id,
    action: "chat_customer_message_added",
    entity: "ChatSession",
    entityId: session.id,
    ...context,
  });
  return NextResponse.json({ ok: true });
}
