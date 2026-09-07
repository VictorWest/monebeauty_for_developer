import { NextResponse, type NextRequest } from "next/server";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeConversationMessages } from "@/lib/chat-handoff";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const session = await prisma.chatSession.findFirst({
    where: {
      id,
      handoffRequested: true,
      archivedAt: null,
      anonymizedAt: null,
    },
    include: {
      outboundMessages: {
        orderBy: { createdAt: "desc" },
        include: {
          attempts: { orderBy: { attemptedAt: "desc" } },
        },
      },
    },
  });
  if (!session)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  await auditForUser(user, "chat_sensitive_details_viewed", "ChatSession", id, {
    request: req,
  });
  return NextResponse.json(
    {
      session: {
        ...session,
        publicTokenHash: undefined,
        messages: normalizeConversationMessages(session.messages),
      },
      canArchive: true,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const payload = (await req.json().catch(() => null)) as {
    intent?: unknown;
  } | null;
  const intent = String(payload?.intent ?? "");
  if (!["resolve", "reopen", "archive"].includes(intent)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  const updated = await prisma.chatSession.updateMany({
    where: {
      id,
      handoffRequested: true,
      archivedAt: null,
      anonymizedAt: null,
    },
    data:
      intent === "resolve"
        ? { status: "RESOLVED" }
        : intent === "reopen"
          ? { status: "OPEN", archivedAt: null }
          : { archivedAt: new Date() },
  });
  if (!updated.count)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  await auditForUser(user, `chat_${intent}`, "ChatSession", id, {
    request: req,
  });
  return NextResponse.json({ ok: true });
}
