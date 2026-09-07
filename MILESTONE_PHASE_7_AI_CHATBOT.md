# Milestone: Phase 7 AI Chatbot

Status: implemented, automated verification passed. Phase 6 notifications/reminders were
intentionally skipped and remain deferred.

## What Was Already Done Before This Milestone

- [x] Phase 5 custom Prisma auth and admin are implemented.
- [x] `ChatSession` existed in Prisma from the baseline schema.
- [x] The public `ChatWidget` existed as a placeholder FAB.
- [x] Public content, products, and admin content overrides are available through generated
      JSON and Prisma fallback helpers.

## Phase 7 Implementation Checklist

- [x] Add `@anthropic-ai/sdk`.
- [x] Add `ANTHROPIC_MODEL` environment setting.
- [x] Extend `ChatSession` with handoff contact fields, status, and `updatedAt`.
- [x] Add `ChatHandoffStatus` enum and migration `20260702100000_phase7_chatbot`.
- [x] Add grounded content retrieval from clinic facts, booking services, content pages,
      products, and blog content.
- [x] Add Claude wrapper with strict approved-content-only system prompt.
- [x] Add `POST /api/chat`.
- [x] Add `POST /api/chat/handoff`.
- [x] Replace placeholder chat FAB with a real GDPR-consented chat panel.
- [x] Add booking deep-link action for detected bookable services.
- [x] Add human handoff form in the chat widget.
- [x] Persist transcripts only when GDPR consent is checked.
- [x] Add `/admin/chat` handoff queue.
- [x] Add `/admin/chat/[id]` transcript detail with resolve/reopen actions.
- [x] Add chat handoff count to the admin dashboard.
- [x] Add EN/FI/RU chat UI copy.
- [x] Update roadmap and project docs.

## Verification Checklist

- [x] `npm run db:generate`
- [x] `npm run lint`
- [x] `npm run build`
- [ ] Run `npm run db:migrate` against the target `DATABASE_URL`.
- [ ] Set `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL`.
- [ ] Manual smoke: open/close chat at desktop and 390px mobile.
- [ ] Manual smoke: send a known service question and verify grounded answer + booking CTA.
- [ ] Manual smoke: send an unknown or medical-risk question and verify no invented claims.
- [ ] Manual smoke: leave `ANTHROPIC_API_KEY` unset and verify graceful fallback.
- [ ] Manual smoke: submit handoff and verify it appears in `/admin/chat`.
- [ ] Manual smoke: resolve/reopen a handoff and verify `AuditLog` row.

## Deferred Work

- [ ] Phase 6 email/SMS confirmations, reminders, and staff alerts.
- [ ] Streaming token-by-token UI; current v1 returns a complete answer.
- [ ] Vector search or embeddings for larger content volume.
- [ ] Client account linking for chat history.
- [ ] Admin assignment/comments on handoff threads.

## Resume Notes

- Chat API lives in `app/api/chat/route.ts`.
- Handoff API lives in `app/api/chat/handoff/route.ts`.
- Retrieval lives in `lib/chat-knowledge.ts`.
- Claude integration lives in `lib/ai.ts`.
- Public widget lives in `components/ui/ChatWidget.tsx`.
- Admin queue lives under `app/admin/(protected)/chat/`.
