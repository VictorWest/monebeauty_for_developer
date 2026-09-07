import { NextResponse, type NextRequest } from "next/server";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { retryOutboundMessage } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const payload = (await req.json().catch(() => null)) as {
    messageId?: unknown;
  } | null;
  const messageId = String(payload?.messageId ?? "");
  const message = await prisma.outboundMessage.findFirst({
    where: { id: messageId, chatSessionId: id },
    select: { id: true },
  });
  if (!message)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const result = await retryOutboundMessage(message.id, user.email);
    await auditForUser(user, "chat_communication_retried", "ChatSession", id, {
      request: req,
    });
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "retry_failed" }, { status: 409 });
  }
}
