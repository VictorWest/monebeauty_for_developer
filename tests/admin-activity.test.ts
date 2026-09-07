import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BUSINESS_AUDIT_ACTIONS,
  mergeBusinessActivities,
  type BusinessActivity,
} from "../lib/admin-activity";

test("business activity is merged chronologically and limited", () => {
  const activity = (
    id: string,
    at: string,
    category: BusinessActivity["category"],
  ): BusinessActivity => ({
    id,
    at: new Date(at),
    category,
    action:
      category === "order"
        ? "orderPlaced"
        : category === "chat"
          ? "chatHandoffRequested"
          : category === "treatment"
            ? "treatmentUpdated"
            : "appointmentBooked",
  });
  const merged = mergeBusinessActivities(
    [
      [activity("appointment", "2026-07-18T10:00:00Z", "appointment")],
      [activity("order", "2026-07-18T12:00:00Z", "order")],
      [activity("chat", "2026-07-18T11:00:00Z", "chat")],
    ],
    2,
  );
  assert.deepEqual(
    merged.map((item) => item.id),
    ["order", "chat"],
  );
});

test("dashboard business audit allowlist excludes technical delivery noise", () => {
  assert.equal(BUSINESS_AUDIT_ACTIONS.includes("order_confirmed"), true);
  assert.equal(BUSINESS_AUDIT_ACTIONS.includes("service_updated"), true);
  assert.equal(BUSINESS_AUDIT_ACTIONS.includes("chat_handoff_requested"), true);
  for (const excluded of [
    "custom_email_sent",
    "custom_sms_sent",
    "communication_retry_sent",
    "booking_confirmation_unhandled_error",
  ]) {
    assert.equal(
      (BUSINESS_AUDIT_ACTIONS as readonly string[]).includes(excluded),
      false,
    );
  }
});

test("chat handoffs become durable business events", () => {
  const handoff = readFileSync("app/api/chat/handoff/route.ts", "utf8");
  assert.match(handoff, /prisma\.\$transaction/);
  assert.match(handoff, /action: "chat_handoff_requested"/);
  assert.match(handoff, /entity: "ChatSession"/);
});

test("dashboard renders localized linked business activity", () => {
  const router = readFileSync("components/admin/AdminRouter.tsx", "utf8");
  assert.match(router, /getRecentBusinessActivity\(locale\)/);
  assert.match(router, /activityAction\(entry\.action\)/);
  assert.match(router, /href=\{entry\.href\}/);
  assert.doesNotMatch(
    router,
    /prisma\.auditLog\.findMany\(\{ orderBy: \{ at: "desc" \}/,
  );
});
