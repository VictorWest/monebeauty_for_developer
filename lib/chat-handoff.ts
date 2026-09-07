export type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ConversationMessage = {
  id?: string;
  role: "user" | "assistant" | "operator";
  content: string;
  senderName?: string;
  channel?: "EMAIL" | "SMS";
  outboundMessageId?: string;
  createdAt?: string;
};

export type ValidHandoff = {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{5,28}[0-9]$/;

export function normalizeTranscript(
  value: unknown,
  maxMessages = 12,
  maxLength = 1200,
): TranscriptMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: unknown }).role;
      const content = String((item as { content?: unknown }).content ?? "")
        .trim()
        .slice(0, maxLength);
      if ((role !== "user" && role !== "assistant") || !content) return null;
      return { role, content };
    })
    .filter((item): item is TranscriptMessage => Boolean(item))
    .slice(-maxMessages);
}

export function normalizeConversationMessages(
  value: unknown,
  maxMessages = 100,
): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const role = source.role;
      const content = String(source.content ?? "")
        .trim()
        .slice(0, role === "operator" ? 5000 : 1200);
      if (
        (role !== "user" && role !== "assistant" && role !== "operator") ||
        !content
      ) {
        return null;
      }
      return {
        ...(typeof source.id === "string" && source.id.trim()
          ? { id: source.id.trim().slice(0, 100) }
          : {}),
        role,
        content,
        ...(role === "operator"
          ? {
              senderName: String(source.senderName ?? "")
                .trim()
                .slice(0, 160),
              ...(source.channel === "EMAIL" || source.channel === "SMS"
                ? { channel: source.channel }
                : {}),
              ...(typeof source.outboundMessageId === "string" &&
              source.outboundMessageId.trim()
                ? {
                    outboundMessageId: source.outboundMessageId
                      .trim()
                      .slice(0, 100),
                  }
                : {}),
              createdAt: String(source.createdAt ?? "")
                .trim()
                .slice(0, 40),
            }
          : {}),
      } as ConversationMessage;
    })
    .filter((item): item is ConversationMessage => Boolean(item))
    .slice(-maxMessages);
}

export function validateHandoff(
  payload: Record<string, unknown>,
): { ok: true; value: ValidHandoff } | { ok: false; error: string } {
  const contactName = String(payload.name ?? "")
    .trim()
    .slice(0, 160);
  const contactEmail = String(payload.email ?? "")
    .trim()
    .slice(0, 200);
  const contactPhone = String(payload.phone ?? "")
    .trim()
    .slice(0, 80);
  const message = String(payload.message ?? "")
    .trim()
    .slice(0, 1200);

  if (!contactName) return { ok: false, error: "name_required" };
  if (!message) return { ok: false, error: "message_required" };
  if (!contactEmail && !contactPhone) {
    return { ok: false, error: "contact_required" };
  }
  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "email_invalid" };
  }
  if (contactPhone && !PHONE_RE.test(contactPhone)) {
    return { ok: false, error: "phone_invalid" };
  }

  return {
    ok: true,
    value: {
      contactName,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      message,
    },
  };
}
