import { smsSegments } from "@/lib/sms";

export type ChatReplyChannel = "EMAIL" | "SMS";

export type ChatReplyInput = {
  channels: ChatReplyChannel[];
  subject: string;
  body: string;
};

export type ChatReplyError =
  "validation" | "email_unavailable" | "sms_unavailable" | "sms_too_long";

export function validateChatReply(
  payload: Record<string, unknown>,
  destinations: { email: string | null; phone: string | null },
): { ok: true; value: ChatReplyInput } | { ok: false; error: ChatReplyError } {
  if (!Array.isArray(payload.channels)) {
    return { ok: false, error: "validation" };
  }

  const channels: ChatReplyChannel[] = [];
  for (const value of payload.channels) {
    if (value !== "EMAIL" && value !== "SMS") {
      return { ok: false, error: "validation" };
    }
    if (!channels.includes(value)) channels.push(value);
  }

  const body = String(payload.body ?? "")
    .trim()
    .slice(0, 5000);
  if (!body) return { ok: false, error: "validation" };
  if (channels.includes("EMAIL") && !destinations.email) {
    return { ok: false, error: "email_unavailable" };
  }
  if (channels.includes("SMS") && !destinations.phone) {
    return { ok: false, error: "sms_unavailable" };
  }
  if (channels.includes("SMS") && smsSegments(body).segments > 3) {
    return { ok: false, error: "sms_too_long" };
  }

  return {
    ok: true,
    value: {
      channels,
      subject: String(payload.subject ?? "")
        .trim()
        .slice(0, 160),
      body,
    },
  };
}
