-- Chat delivery records were added after the original two-parent constraint.
-- Replace the deployed constraint so every outbound message still has one parent.
ALTER TABLE "OutboundMessage"
  DROP CONSTRAINT "OutboundMessage_parent_check";

ALTER TABLE "OutboundMessage"
  ADD CONSTRAINT "OutboundMessage_parent_check" CHECK (
    num_nonnulls("orderId", "appointmentId", "chatSessionId") = 1
  );
