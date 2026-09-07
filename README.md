# Mone Beauty

Tri-lingual website, booking flow, shop, CRM, staff calendar, custom admin, and AI chatbot for
**Mone Beauty Clinic**, a next-generation aesthetic-medicine clinic in Helsinki.

Repository: https://github.com/ayenisholah/monebeauty.git

## Status

This is an implemented Next.js application, not a planning-only repository. The current baseline
includes:

- Public FI/EN/RU marketing pages with Finnish public path segments.
- Online booking with resource-safe availability and staff/admin calendar operations.
- Stripe Checkout for website product, gift-card, and prepaid voucher purchases.
- Optional client accounts, staff accounts, custom admin, CRM, audit logs, and integration logs.
- Email/SMS notifications, reminder cron, cookie consent, SEO/GDPR pages, and AI chat handoff.

Phase 9 is in progress: localized admin routing and database-owned public content. See
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for the active roadmap.

## Source Of Truth

Read these before changing product behavior, content architecture, routing, or design:

- [`SCOPE.md`](./SCOPE.md) is the authoritative client brief. It wins for brand, positioning,
  IA, and feature scope.
- [`REQUIREMENTS.md`](./REQUIREMENTS.md) is the distilled binding requirements document.
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) is the phase roadmap and current work log.
- [`design_handoff_mone_beauty_clinic/`](./design_handoff_mone_beauty_clinic/) defines the visual
  system and page-structure reference.
- `scraped_content/` is the git-ignored source archive for existing live-site copy and media.

Brand is **Mone Beauty Clinic**. Do not reintroduce "Mone Beauty Club" except where preserving
scraped historical source material before normalization.

## Product Scope

- **Public site:** homepage, clinic/about, services, device treatments, trichology, AROSHA,
  pricing, articles, legal pages, sitemap, robots, JSON-LD, and `hreflang`.
- **Booking:** public Service -> Time -> You flow, internal resource allocation, appointment
  persistence, customer management links, staff/admin creation and rescheduling.
- **Shop:** product catalog, cart, Stripe-hosted checkout, order pages, pickup/shipping, refunds,
  gift cards, and prepaid treatment vouchers.
- **Accounts:** optional client account portal, guest appointment claims, saved details, order and
  appointment history.
- **Operations:** custom Prisma admin, CRM, appointment/order queues, staff accounts, shared
  calendar, schedule setup, internal reservations, audit, and integration observability.
- **Messaging:** localized transactional email/SMS, staff alerts, appointment reminders.
- **AI chat:** Anthropic Claude with approved-content retrieval, GDPR consent, transcript storage,
  booking links, and human handoff review.

## Tech Stack

| Layer          | Choice                                                         |
| -------------- | -------------------------------------------------------------- |
| Framework      | Next.js App Router, React, TypeScript                          |
| Styling        | Tailwind CSS, tokens from `01-design-system.md`                |
| Fonts / Icons  | `next/font`, Cormorant Garamond, Jost, `@phosphor-icons/react` |
| Database / ORM | PostgreSQL, Prisma                                             |
| i18n           | `next-intl` with FI default plus `/en` and `/ru`               |
| Payments       | Stripe Checkout and signed webhooks                            |
| Notifications  | Resend/Postmark email, Sinch/Twilio or webhook SMS             |
| AI             | Anthropic Claude API                                           |
| Media Uploads  | Cloudinary for admin uploads                                   |

The CMS/admin is custom-built on Prisma. Payload CMS is intentionally not used.

## Repository Layout

```text
.
|-- app/                              # Next.js route groups, public/admin/API routes
|-- components/                       # Public, booking, shop, admin, calendar, and UI components
|-- content/                          # Authored content and generated scraped-content registries
|-- i18n/                             # Locale routing helpers
|-- lib/                              # Server/client domain logic and integrations
|-- messages/                         # FI/EN/RU interface translations
|-- prisma/                           # Schema, migrations, seed
|-- public/                           # Logo, favicon, committed media used by the app
|-- scripts/                          # Content sync, scheduling, admin, notification utilities
|-- tests/                            # Node test runner tests
|-- design_handoff_mone_beauty_clinic/ # Design system and reference handoff
|-- scraped_content/                  # Git-ignored live-site scrape source
`-- ecosystem.config.cjs              # PM2 app and reminder cron configuration
```

## Local Setup

Prerequisites:

- Node.js 20.x
- npm
- PostgreSQL 15+ recommended

Install and configure:

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:sync-content
npm run dev
```

`npm run db:migrate` uses `prisma migrate dev` and therefore requires a local PostgreSQL user
that can create Prisma's shadow database. When `.env` points to a hosted or shared database, use
`npm run db:migrate:deploy` instead; it applies committed migrations without creating a shadow
database.

The dev server runs on http://localhost:5000.

Set `NEXT_PUBLIC_SITE_URL="http://localhost:5000"` in `.env` for local callbacks, signed links,
chat smoke tests, and canonical URL generation.

Create an admin account through seed variables or the helper script:

```bash
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="change-this-password" npm run db:create-admin
```

For realistic local calendar testing, also provision calendar staff and templates:

```bash
npm run db:provision-calendar-staff
npm run db:sync-calendar-templates
```

On an isolated testing environment, all four test employees can be assigned to every
bookable service and compatible resource in one provisioning pass:

```bash
ASSIGN_ALL_STAFF_TO_SERVICES=true npm run db:provision-calendar-staff
```

Use that flag only for test data. Production employee qualifications must be configured
explicitly in the Staff administration UI.

## Environment

Start from [`.env.example`](./.env.example). Important groups:

- `DATABASE_URL`: PostgreSQL connection string.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`: bootstrap admin credentials.
- `AUTH_SECRET`, `APPOINTMENT_ACCESS_SECRET`, `ORDER_ACCESS_SECRET`,
  `APPOINTMENT_CALENDAR_SECRET`: long random server-side secrets.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_FINLAND_SHIPPING_RATE_ID`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: website payments. Appointment bookings remain paid at
  the clinic.
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`: chatbot provider (Google Gemini, via its
  OpenAI-compatible endpoint).
- `NOTIFICATIONS_ENABLED`, `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`, Sinch/Twilio/webhook SMS
  variables: transactional messaging.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL`: admin
  image uploads.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`: canonical URL and consent-gated analytics.

Never commit `.env`. In production, keep the database and external services in EU-compatible
regions where possible because appointment and CRM data can include special-category data.

## Common Commands

| Command                                  | Purpose                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                            | Start Next.js on port 5000                                                 |
| `npm run build`                          | Production build                                                           |
| `npm run start`                          | Serve the production build on port 5000                                    |
| `npm run lint`                           | Run ESLint                                                                 |
| `npm run test`                           | Run the TypeScript test suite                                              |
| `npm run format:check`                   | Check Prettier formatting                                                  |
| `npm run db:generate`                    | Generate Prisma client                                                     |
| `npm run db:migrate`                     | Develop/apply migrations against a local database with shadow-DB access    |
| `npm run db:migrate:deploy`              | Apply committed migrations to a hosted or shared database                  |
| `npm run db:migrate:status`              | Report whether committed migrations are applied                            |
| `npm run db:seed`                        | Seed base data and optional admin                                          |
| `npm run db:sync-content`                | Insert generated content into the database without overwriting admin edits |
| `npm run db:sync-content:force`          | Force-refresh imported generated content                                   |
| `npm run db:sync-procedure-descriptions` | Preview guarded localized procedure-copy updates                           |
| `npm run notifications:reminders`        | Send due 24-hour and 2-hour appointment reminders                          |
| `npm run chat:check-provider`            | Verify Gemini credentials/model access                                     |
| `npm run chat:smoke`                     | Smoke-test grounded chat against a running app                             |

Some source-refresh scripts are intentionally not package scripts:

```bash
node scripts/gen-content.mjs
node scripts/copy-media.mjs
npm run content:gen-calendar-services
```

## Content And Media Workflow

Existing live-site copy and media come from `scraped_content/`, which is intentionally
git-ignored. The app reads committed registries and public assets instead:

- `scripts/gen-content.mjs` reads `scraped_content/{fi,en,ru}` and writes
  `content/generated/*.json`.
- `scripts/copy-media.mjs` copies referenced scraped assets into `public/media/**`.
- `content/authored-pages.ts` contains hand-authored non-clinical stubs for scope services that
  do not exist in the scrape.
- `scripts/sync-cms-from-generated.ts` imports generated content into Prisma. Normal sync is
  insert-only; `--force` explicitly updates imported records.

Do not invent medical claims. For injectable aesthetic medicine and medical consultation, keep
clinical details marked for clinic review unless the clinic supplies approved wording.

Admin media uploads accept existing `/media/...` paths or Cloudinary uploads. Accepted upload
types are JPG, PNG, WebP, AVIF, and GIF up to 25 MB. SVG uploads are rejected.

## Routing

Finnish is the default locale and uses unprefixed URLs. English and Russian use `/en` and `/ru`.
Public paths use the same Finnish path segments in all locales.

Examples:

- `/ajanvaraus`, `/en/ajanvaraus`, `/ru/ajanvaraus`
- `/palvelut`, `/en/palvelut`, `/ru/palvelut`
- `/laitehoidot/endosphere`, `/en/laitehoidot/endosphere`
- `/verkkokauppa`, `/ostoskori`, `/kassa`, `/tilaus/[id]`
- `/oma-tili`
- `/henkilosto`
- `/admin` and localized admin equivalents

Legacy English public/admin paths are redirected to canonical Finnish-segment URLs where the app
supports them.

## Quality Checks

Before handing off meaningful code changes, run the relevant checks:

```bash
npm run lint
npm run test
npm run build
```

For UI work, verify mobile first at 390 px. Preserve WCAG AA accessibility, keyboard access,
localized labels, `prefers-reduced-motion`, and the design tokens from the handoff.

## Deployment

Production should run in an EU region with SSL and an EU-hosted PostgreSQL database.

`SENSITIVE_DATA_ENCRYPTION_KEY` is a required, durable production secret containing exactly
32 random bytes encoded as base64 (or 64 hexadecimal characters). Keep it out of logs and
commits. After consultation profiles have been encrypted, do not rotate this key without a
dedicated migration that decrypts every profile with the old key and re-encrypts it with the
new key; replacing it directly makes existing consultation data unreadable.

For the direct PM2 deployment used by this project, deploy from the directory PM2 reports as the
app `cwd`:

```bash
pm2 describe monebeauty
pm2 stop monebeauty
git pull origin main
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run db:sync-content
npm run db:migrate-treatment-options:apply
npm run db:sync-procedure-descriptions -- --apply
npm run db:sync-procedure-media
npm run build
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

After first deploying the admin-managed media migration, run its guarded backfill in this order:

```bash
npm run db:migrate:status
npm run db:migrate-admin-media
npm run db:migrate-admin-media:apply
npm run db:migrate-admin-media
```

Only run the apply command after the dry run succeeds. The final dry run should report no
remaining changes. If the schema migration is missing, the backfill exits without writing and
instructs the operator to run `npm run db:migrate:deploy` first.

`ecosystem.config.cjs` serves the web app on port `5000` and runs
`npm run notifications:reminders` every 30 minutes. PM2 production must not run Next.js in watch
mode.

Run `npm run db:sync-procedure-descriptions` without `--apply` first when upgrading an existing
database. The guarded command reports and skips localized bodies with unrelated admin edits;
`--rollback` restores only exact copies written by the committed editorial registry.

Verification:

```bash
pm2 list
pm2 logs monebeauty --lines 50
curl -I http://127.0.0.1:5000/
curl -I http://77.42.124.215:5000/
```

If deploying a release that changes procedure media, keep the rollback helper available before
switching to an older application revision:

```bash
npm run db:rollback-procedure-media
npm run db:rollback-procedure-media -- --apply
```

The first command is a dry run. The second deletes only procedure-media rows owned by the
committed registry and leaves services, unrelated media, migrations, and the additive table intact.

## Documentation Index

| Document                                                                                 | Purpose                        |
| ---------------------------------------------------------------------------------------- | ------------------------------ |
| [`SCOPE.md`](./SCOPE.md)                                                                 | Authoritative client brief     |
| [`REQUIREMENTS.md`](./REQUIREMENTS.md)                                                   | Binding requirements           |
| [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)                                     | Current roadmap and milestones |
| [`SCHEDULING_CLASH_IMPLEMENTATION_PLAN.md`](./SCHEDULING_CLASH_IMPLEMENTATION_PLAN.md)   | Resource-safe scheduling plan  |
| [`CHANGELOG.md`](./CHANGELOG.md)                                                         | Project change history         |
| [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)                                                   | Known limitations              |
| [`MILESTONE_PHASE_2_ECOMMERCE.md`](./MILESTONE_PHASE_2_ECOMMERCE.md)                     | E-commerce milestone           |
| [`MILESTONE_PHASE_3_BOOKING.md`](./MILESTONE_PHASE_3_BOOKING.md)                         | Booking milestone              |
| [`MILESTONE_PHASE_4_STAFF_SCHEDULE.md`](./MILESTONE_PHASE_4_STAFF_SCHEDULE.md)           | Staff schedule milestone       |
| [`MILESTONE_PHASE_5_CRM_ADMIN_AUTH.md`](./MILESTONE_PHASE_5_CRM_ADMIN_AUTH.md)           | CRM, admin, and auth milestone |
| [`MILESTONE_PHASE_6_NOTIFICATIONS.md`](./MILESTONE_PHASE_6_NOTIFICATIONS.md)             | Notifications milestone        |
| [`MILESTONE_PHASE_7_AI_CHATBOT.md`](./MILESTONE_PHASE_7_AI_CHATBOT.md)                   | AI chatbot milestone           |
| [`MILESTONE_PHASE_8_SEO_GDPR.md`](./MILESTONE_PHASE_8_SEO_GDPR.md)                       | SEO and GDPR milestone         |
| [`PROJECT_OWNER_CALENDAR_BOOKING_REVIEW.md`](./PROJECT_OWNER_CALENDAR_BOOKING_REVIEW.md) | Owner review notes             |
| [`AGENTS.md`](./AGENTS.md) / [`CLAUDE.md`](./CLAUDE.md)                                  | Agent guardrails               |

## Commit Policy

Commits must be authored by the repository owner only. Do not add Anthropic, Claude, or Codex as
a co-author, author, or contributor, and do not include generated-by trailers or lines in commit
messages.

## License

Proprietary. Copyright 2026 Mone Beauty Clinic. All rights reserved.
