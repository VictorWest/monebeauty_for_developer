import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tokenHash, type AuthUser } from "@/lib/auth";
import {
  normalizeConversationMessages,
  type ConversationMessage,
} from "@/lib/chat-handoff";

export function createPublicChatToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: tokenHash(token) };
}

export async function operatorDisplayName(user: AuthUser) {
  if (user.role === "STAFF") {
    const staff = await prisma.staffUser.findUnique({
      where: { userId: user.id },
      select: { practitioner: { select: { name: true } } },
    });
    return staff?.practitioner?.name || user.name || "Mone Beauty Clinic";
  }
  return user.name || "Mone Beauty Clinic";
}

export async function appendConversationMessage(
  chatSessionId: string,
  message: ConversationMessage,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`chat:${chatSessionId}`}, 0))`;
      const session = await tx.chatSession.findUnique({
        where: { id: chatSessionId },
        select: { messages: true },
      });
      if (!session) throw new Error("chat_not_found");
      const messages = normalizeConversationMessages(session.messages);
      if (
        (message.id && messages.some((item) => item.id === message.id)) ||
        (message.outboundMessageId &&
          messages.some(
            (item) => item.outboundMessageId === message.outboundMessageId,
          ))
      ) {
        return messages;
      }
      const next = [...messages, message].slice(-100);
      await tx.chatSession.update({
        where: { id: chatSessionId },
        data: {
          messages: next as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
      return next;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export function operatorMessage(input: {
  content: string;
  senderName: string;
}): ConversationMessage {
  return {
    id: randomUUID(),
    role: "operator",
    content: input.content,
    senderName: input.senderName,
    createdAt: new Date().toISOString(),
  };
}
