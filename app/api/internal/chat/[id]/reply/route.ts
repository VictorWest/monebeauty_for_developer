import { NextResponse, type NextRequest } from "next/server";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  appendConversationMessage,
  operatorDisplayName,
  operatorMessage,
} from "@/lib/chat-conversations";
import { validateChatReply, type ChatReplyChannel } from "@/lib/chat-replies";
import { sendCustomMessage } from "@/lib/notifications";
import type { Locale } from "@/i18n/routing";

const SUBJECTS: Record<Locale, string> = {
  fi: "Mone Beauty Clinic: vastaus yhteydenottoosi",
  en: "Mone Beauty Clinic: reply to your enquiry",
  ru: "Mone Beauty Clinic: ответ на ваше обращение",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload)
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  const session = await prisma.chatSession.findFirst({
    where: {
      id,
      handoffRequested: true,
      archivedAt: null,
      anonymizedAt: null,
    },
    select: {
      id: true,
      locale: true,
      contactEmail: true,
      contactPhone: true,
    },
  });
  if (!session)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = validateChatReply(payload, {
    email: session.contactEmail,
    phone: session.contactPhone,
  });
  if (!parsed.ok)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { channels, body } = parsed.value;
  const subject = parsed.value.subject || SUBJECTS[session.locale as Locale];
  const senderName = await operatorDisplayName(user);
  const chatMessage = operatorMessage({ content: body, senderName });
  await appendConversationMessage(session.id, chatMessage);

  const deliveries = await Promise.all(
    channels.map(async (channel) => {
      try {
        const result = await sendCustomMessage({
          parent: { chatSessionId: session.id },
          channel,
          locale: session.locale as Locale,
          recipient: recipientFor(channel, session),
          subject,
          body,
          actor: user.email,
          reference: session.id.slice(-8).toUpperCase(),
        });
        return {
          channel,
          status: result.status,
          messageId: result.messageId,
        };
      } catch {
        return { channel, status: "failed" as const };
      }
    }),
  );

  await Promise.allSettled([
    auditForUser(user, "chat_reply_published", "ChatSession", session.id, {
      request: req,
    }),
    ...deliveries.map((delivery) =>
      auditForUser(
        user,
        `chat_${delivery.channel.toLowerCase()}_${delivery.status}`,
        "ChatSession",
        session.id,
        { request: req },
      ),
    ),
  ]);
  return NextResponse.json({
    chat: { status: "published", message: chatMessage },
    deliveries,
  });
}

function recipientFor(
  channel: ChatReplyChannel,
  session: { contactEmail: string | null; contactPhone: string | null },
) {
  return (channel === "EMAIL" ? session.contactEmail : session.contactPhone)!;
}
