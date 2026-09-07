# Phase 6 — Notifications + reminders

Status: implemented at provider-integration scope.

## What shipped

- Booking confirmations send SMS and email after a successful persisted appointment.
- Staff booking alerts send to configured staff email/SMS recipients.
- Checkout sends order confirmation email to the customer and staff order alerts.
- Notification attempts are recorded in `AuditLog` as sent, skipped, or failed.
- `npm run notifications:reminders` sends 24-hour and 2-hour appointment reminders.
- `ecosystem.config.cjs` schedules the reminder job every 30 minutes under PM2.

## Providers

Email supports Resend (`RESEND_API_KEY` or `EMAIL_API_KEY`) and Postmark
(`POSTMARK_SERVER_TOKEN`). SMS supports Twilio (`TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM`) or a generic webhook (`SMS_WEBHOOK_URL` plus optional
`SMS_API_KEY` bearer token).

If provider credentials are missing, sends are skipped and audited; booking and checkout
requests still complete.

## Deferred

- Payment capture.
- Rich admin notification-policy editing.
- Provider-specific delivery webhooks and bounce handling.
