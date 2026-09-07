import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeConversationMessages } from "../lib/chat-handoff";
import { validateChatReply } from "../lib/chat-replies";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260731190000_two_way_chat_handoffs/migration.sql",
);
const parentConstraintMigration = read(
  "prisma/migrations/20260731203000_outbound_message_chat_parent_check/migration.sql",
);
const handoff = read("app/api/chat/handoff/route.ts");
const publicSession = read("app/api/chat/session/route.ts");
const internalDetail = read("app/api/internal/chat/[id]/route.ts");
const internalReply = read("app/api/internal/chat/[id]/reply/route.ts");
const retryReply = read("app/api/internal/chat/[id]/retry/route.ts");
const workspace = read("components/chat/ConversationWorkspace.tsx");
const widget = read("components/ui/ChatWidget.tsx");
const admin = read("components/admin/AdminRouter.tsx");
const staff = read("app/(public)/[locale]/henkilosto/page.tsx");
const notifications = read("lib/notifications.ts");
const replyValidation = read("lib/chat-replies.ts");

test("chat replies have durable delivery and token-backed customer access", () => {
  assert.match(schema, /model OutboundMessage[\s\S]*?chatSessionId\s+String\?/);
  assert.match(schema, /model ChatSession[\s\S]*?publicTokenHash\s+String\?/);
  assert.match(schema, /outboundMessages\s+OutboundMessage\[\]/);
  assert.match(migration, /OutboundMessage_chatSessionId_fkey/);
  assert.match(
    parentConstraintMigration,
    /DROP CONSTRAINT "OutboundMessage_parent_check"/,
  );
  assert.match(
    parentConstraintMigration,
    /num_nonnulls\("orderId", "appointmentId", "chatSessionId"\) = 1/,
  );
  assert.match(handoff, /createPublicChatToken/);
  assert.match(handoff, /publicTokenHash: publicAccess\.hash/);
  assert.match(handoff, /token: publicAccess\.token/);
  assert.match(publicSession, /publicTokenHash: tokenHash\(token\)/);
  assert.match(publicSession, /Cache-Control.*private, no-store/);
  assert.match(publicSession, /authRateLimited/);
});

test("staff and admin share replies and archive in the back office", () => {
  for (const route of [internalDetail, internalReply]) {
    assert.match(route, /requireApiUser\(\["ADMIN", "STAFF"\]\)/);
  }
  assert.match(internalReply, /sendCustomMessage/);
  assert.match(internalReply, /operatorDisplayName/);
  assert.match(internalReply, /appendConversationMessage/);
  assert.match(replyValidation, /smsSegments\(body\)\.segments > 3/);
  assert.match(workspace, /canArchive \?/);
  assert.match(staff, /redirect\(adminBase\(appLocale\)\)/);
  assert.match(admin, /<ConversationWorkspace locale=\{locale\}/);
  assert.match(internalDetail, /canArchive: true/);
  const chats = admin.slice(
    admin.indexOf("async function Chats"),
    admin.indexOf("function EntityForm"),
  );
  assert.doesNotMatch(chats, /Anonymize|anonymize/);
});

test("email and SMS replies reuse the established provider pipeline", () => {
  assert.match(notifications, /renderCustomEmail/);
  assert.match(notifications, /parent: Parent/);
  assert.match(notifications, /chatSessionId: string/);
  assert.match(internalReply, /parent: \{ chatSessionId: session\.id \}/);
  assert.match(internalReply, /appendConversationMessage[\s\S]*Promise\.all/);
  assert.match(internalReply, /chat: \{ status: "published"/);
  assert.match(internalReply, /deliveries/);
  assert.doesNotMatch(retryReply, /appendConversationMessage|operatorMessage/);
  assert.match(
    notifications,
    /const stored =[\s\S]*?await (?:sendEmail|sendSms)/,
  );
  assert.match(notifications, /await prisma\.deliveryAttempt\.create/);
  assert.match(workspace, /Delivery history/);
  assert.match(workspace, /\/retry/);
});

test("chat reply validation supports every external-channel combination", () => {
  const destinations = { email: "client@example.com", phone: "+358401234567" };
  for (const channels of [[], ["EMAIL"], ["SMS"], ["EMAIL", "SMS"]] as const) {
    const result = validateChatReply(
      { channels: [...channels], subject: "Hello", body: "Reply" },
      destinations,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.value.channels, channels);
  }
});

test("chat reply validation rejects missing content and unavailable destinations", () => {
  assert.deepEqual(
    validateChatReply({ channels: [], body: "" }, { email: null, phone: null }),
    { ok: false, error: "validation" },
  );
  assert.deepEqual(
    validateChatReply(
      { channels: ["EMAIL"], body: "Reply" },
      { email: null, phone: "+358401234567" },
    ),
    { ok: false, error: "email_unavailable" },
  );
  assert.deepEqual(
    validateChatReply(
      { channels: ["SMS"], body: "Reply" },
      { email: "client@example.com", phone: null },
    ),
    { ok: false, error: "sms_unavailable" },
  );
  assert.deepEqual(
    validateChatReply(
      { channels: ["SMS"], body: "x".repeat(5000) },
      { email: null, phone: "+358401234567" },
    ),
    { ok: false, error: "sms_too_long" },
  );
});

test("reply composer defaults email on, keeps SMS opt-in, and resets by conversation", () => {
  assert.match(workspace, /key=\{detail\.id\}/);
  assert.match(workspace, /detail\.contactEmail \? \["EMAIL"\] : \[\]/);
  assert.doesNotMatch(
    workspace,
    /useState<Array<"EMAIL" \| "SMS">>\(\["SMS"\]\)/,
  );
  assert.match(workspace, /disabled=\{!available\}/);
  assert.match(workspace, /aria-label=\{`\$\{t\.websiteChat\}/);
  assert.match(workspace, /emailSelected \?/);
  assert.match(workspace, /smsSelected \?/);
});

test("the widget becomes a live named human conversation after handoff", () => {
  assert.match(widget, /HUMAN_CHAT_STORAGE_KEY/);
  assert.match(widget, /window\.sessionStorage\.setItem/);
  assert.match(widget, /X-Chat-Token/);
  assert.match(
    widget,
    /window\.setInterval\(refresh, open \? 15_000 : 30_000\)/,
  );
  assert.match(widget, /if \(humanMode && sessionId && chatToken\)/);
  assert.match(widget, /sendHumanMessage/);
  assert.match(widget, /message\.senderName \|\| t\("operatorFallback"\)/);
  assert.match(widget, /humanMode \? t\("humanPlaceholder"\)/);
});

test("conversation normalization preserves safe operator identity snapshots", () => {
  assert.deepEqual(
    normalizeConversationMessages([
      { role: "user", content: " Hello " },
      {
        id: "operator-message-1",
        role: "operator",
        content: " We can help. ",
        senderName: " Irene ",
        channel: "SMS",
        outboundMessageId: "message-1",
        createdAt: "2026-07-31T12:00:00.000Z",
      },
      { role: "system", content: "hidden" },
    ]),
    [
      { role: "user", content: "Hello" },
      {
        id: "operator-message-1",
        role: "operator",
        content: "We can help.",
        senderName: "Irene",
        channel: "SMS",
        outboundMessageId: "message-1",
        createdAt: "2026-07-31T12:00:00.000Z",
      },
    ],
  );
});
