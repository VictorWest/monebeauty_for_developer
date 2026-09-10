# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Progress maps to the phases in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

## [Unreleased]

### Content migration: the old site's own copy

The clinic reported that the migrated text was not theirs. The scrape was complete
(153/153 routes across all three locales, all HTTP 200, converter fidelity ~1.00 against the
raw HTML); the loss was downstream, in generated copy that displaced the source before it
reached the database.

- Removed the templated treatment enrichment that appended seven sections to all 361
  localized records, and the `procedure-editorial` layer that replaced scraped descriptions
  with paraphrases. A treatment description is now the source text verbatim; the generated
  registry halved, from 1.83 MB to 950 KB.
- Card summaries kept only the first Markdown block, dropping the "Duration / Area of choice"
  lines beneath the opening sentence and leaving cards looking empty. Summaries now take the
  leading run of source blocks, stopping at a heading, list, price or section label.
- Recovered ten Finnish treatments the card parser was discarding: eight packages whose
  titles ("30 minuutin hoitopaketit 6 kerta") were mistaken for price lines, plus the eyebrow
  tinting combination and the "Uudistuminen" package, which title themselves with `###`.
  Finnish packages went from 63% to 97% of the page's words.
- Stripped YAML quoting from archived front matter. Every page title was literally
  `"Body treatments in Helsinki"`, which rendered the quotes and defeated the `in Helsinki`
  suffix strip on the service cards. Also removed the duplicated `/about` heading, which
  survived because the body writes it with emphasis.
- Product size and price are now read from the product's own page. Cutting at the literal
  `## See also` only matched English, so Finnish and Russian kept the whole cross-sell list
  and ten products were given a size printed on a neighbouring product's card.
- Ordered services explicitly: Endospheres, laser and microneedling RF lead. `Service.order`
  was never set, so every row was 0 and the services page fell back to alphabetical slug
  order. Still admin-editable.

### Endospheres

- Reordered the page as the clinic asked: description and photographs, then the booking
  prompt, then treatment cards, then before/after results.
- Added three before/after pairs as admin-managed media slots. No such photograph exists in
  the archive, so the slots have no fallback and the gallery renders nothing until the clinic
  uploads both halves of a pair.
- Published the Finnish and Russian copy, promoted unchanged from the review-only drafts.
  Both locales previously showed a shorter locally-written summary while English carried the
  full clinic PDF. Marked `PENDING_CLINIC_SIGNOFF`: **the clinic has not yet countersigned
  the medical wording in Finnish or Russian.**

### Body treatments

- Linked laser hair removal from the body page: the nineteen zones treated from the shoulders
  down. The published body page has never listed a laser treatment, so this is a new
  cross-link rather than a migration gap, and the zones stay priced in one place.

### Known archive gap

- `scraped_content/{fi,en,ru}/booking.md` have empty bodies: the converter drops `<iframe>`,
  and the old booking page was a third-party embed of
  `https://varaa.timma.fi/monebeautyclub`. The new site has its own booking flow, so nothing
  is broken: the URL is recorded here so it is not lost, in case the clinic still takes
  bookings through Timma.

### Cancellation policy

- Published the client-approved 24-hour cancellation and rescheduling policy in Finnish,
  English, and Russian across booking, emails, appointment management, client accounts,
  clinic rules, and Terms.
- Added a booking notice linking to the full policy: late changes before the appointment date
  incur 50%, while same-day changes and no-shows incur 100%.
- Added a guarded content migration for existing database-owned clinic rules; appointment fee
  administration remains manual and outside Stripe.

### Authentication

- Rotated production login sessions to a versioned secure cookie and clear obsolete cookie
  names during login and logout.
- Made authenticated Server Component rendering tolerate unknown, expired, revoked, and stale
  sessions without attempting forbidden response-cookie mutation.
- Added a deployment migration that revokes all sessions issued before the cookie rotation.

### Phase 6 â€” Notifications + reminders

- Added `lib/notifications.ts` with Resend/Postmark email support, Twilio or generic
  webhook SMS support, staff recipients, and safe skipped/failed audit logging.
- Booking creation now sends customer email/SMS confirmations and staff booking alerts after
  persistence without blocking the user flow on provider failures.
- Checkout now sends customer order confirmation email and staff order alerts.
- Added `npm run notifications:reminders` (`scripts/send-reminders.ts`) for 24-hour and
  2-hour appointment reminders, using `AuditLog` to avoid duplicate reminder sends.
- Added PM2 ecosystem entries for the port-5000 web process and scheduled reminders.

### Phase 8: SEO + GDPR finalize

- Added localized cookie-consent banner and GA4 loading gated behind accepted analytics
  consent.
- Hardened robots rules for admin/API paths and enriched `MedicalClinic` JSON-LD with local
  SEO details.
- Replaced legal placeholders with localized privacy, terms, and cookie policy text.
- Added admin-only GDPR client export and erasure/anonymization flows with audit logging.
- Documented Phase 8 checklist and remaining deployment/manual verification work.

### Phase 7: AI chatbot

- Added Anthropic Claude integration with a strict approved-content-only prompt and
  locale-aware content retrieval from CMS/generated content, products, booking services,
  blog content, and clinic contact facts.
- Replaced the placeholder chat FAB with a real EN/FI/RU chatbot panel, GDPR consent,
  transcript persistence, booking deep-links, and human handoff form.
- Added `/api/chat` and `/api/chat/handoff`, extending `ChatSession` with handoff contact
  fields, status, and update tracking.
- Added `/admin/chat` and `/admin/chat/[id]` for handoff queue review, transcript reading,
  and resolve/reopen actions with audit logging.

### Phase 5: CRM, custom admin & auth

- Added custom Prisma-backed auth with durable `Session` rows, HTTP-only session cookies,
  password hashing, role guards, admin/staff login, and logout.
- Added `/admin` with dashboard, CRM client search/profile editing, service management,
  generated content-page editing, product management, pricing management, and blog article
  management.
- Added `ContentPage` overrides plus `npm run db:sync-content` so generated scraped content
  can be seeded into Prisma and edited from admin while public pages keep JSON fallback.
- Protected `/staff` and `/api/staff/schedule`; admins can manage all schedules, while staff
  users are restricted to their linked practitioner.
- Added audit logging for client profile updates and sensitive contraindication view/edit
  events.
- Updated catalog/product/checkout server paths to prefer Prisma product data where present.

### Phase 4: Staff schedule

- Added an internal `/staff` schedule surface for selecting practitioner/date, reviewing
  daily slots, seeing booked appointment/client details, and saving open/closed slots.
- Added `/api/staff/schedule` to read daily schedule data, persist day-level availability,
  and apply working-hour patterns over a future date range.
- Added shared staff schedule helpers for normalized working hours, generated slots, and
  booked-slot overlays from appointments.
- Added EN/FI/RU staff schedule UI copy. Auth/RBAC remains deferred to Phase 5.

### Phase 3: Booking upgrade

- Upgraded the booking flow from lean single-practitioner booking to a four-step
  Service → Specialist → Time → You wizard with a "no preference" specialist option.
- Added practitioner-aware slot lookup backed by Prisma `Availability.slots` when present,
  with generated business-hour fallback and non-cancelled appointment overlap filtering.
- Added `GET /api/booking/practitioners`, upgraded `GET /api/booking/slots`, and upgraded
  `POST /api/booking` to revalidate the selected practitioner/slot at submit time.
- Added lightweight cancel and reschedule endpoints using appointment reference plus
  matching contact detail.
- Updated `prisma/seed.ts` to connect bookable services to the default practitioner and
  create near-term development availability.

### Phase 2: E-commerce cart & checkout

- Implemented real cart state for the AROSHA/DIXIDOX catalog with `localStorage` persistence,
  add-to-cart buttons, and a live header basket count.
- Replaced the `/basket` placeholder with line items, quantity controls, remove actions,
  item count, subtotal, and a checkout entry point.
- Added `/checkout`, `POST /api/checkout`, and `/order/[id]`: checkout captures client
  details + GDPR consent, recalculates product totals server-side, self-heals Prisma
  `Product` rows, and persists `Client`, `Order`, `OrderItem`, and `Consent` rows.
- Added localized EN/FI/RU cart, checkout, and order confirmation UI. Payment capture and
  confirmation email remain deferred.

### Live-site mirror: real content, media & IA

- **Reoriented the app to mirror the live site** (`monebeauty.fi` = Mone Beauty Club):
  brand, IA, pages, links, logo, and favicon now come from `scraped_content/`.
- **Content pipeline:** `scripts/gen-content.mjs` bakes real per-locale copy (15 content
  pages + 31 products, EN/FI/RU) into committed `content/generated/*.json`;
  `scripts/copy-media.mjs` copies referenced images, the hero video, `logo.svg`, and
  `favicon.ico` into `public/media/**`. Page bodies render via `react-markdown`.
- **Real media everywhere**: replaced gradient placeholders with real photos/video
  (homepage hero video, featured-service images, product photos).
- **Live IA & nav:** header with dropdowns (Instrumental cosmetology, Services), cart,
  "Book time"; footer with opening hours "By agreement". New routes: `/instrumental/[slug]`,
  `/trichology`, `/arosha`, `/services` + 8 subpages, `/catalog` (+ 31 product pages),
  `/basket`. Retired the clinic-only pages (9 treatments, pricing, blog, contact).
- **Homepage** rebuilt: serif brand hero over the real treatment video, 3 featured services,
  and the AROSHA product grid (8) → "See more" → `/catalog`.
- Brand switched to **Mone Beauty Club** (real `logo.svg` + `favicon.ico`); i18n messages
  trimmed to UI chrome (real translations, no `[TODO]`). Sitemap updated to the live routes.
- Updated governance docs (`REQUIREMENTS`, `IMPLEMENTATION_PLAN`, `CLAUDE`, `AGENTS`): new
  source-of-truth hierarchy (scraped = IA+content+media; handoff = visual design only) and a
  binding content-sourcing rule.
- Verified: `next build` (all live routes prerender across 3 locales: 93 product pages),
  `next lint`, and a production smoke test (real logo/hero video, dropdowns, catalog, FI/RU).

### Phase 0: Scaffold

- Scaffolded Next.js 16 (App Router) + TypeScript + Tailwind v4 + ESLint via
  `create-next-app`, preserving the existing project docs.
- Added dependencies: `next-intl`, `@phosphor-icons/react`, Prisma 6 (`prisma`,
  `@prisma/client`), `tsx`, Prettier (+ tailwind plugin).
- Wired brand fonts with `next/font`: Cormorant Garamond (display) + Jost (sans)
  exposed as CSS variables (`lib/fonts.ts`).
- Translated the design system (`design_handoff/01-design-system.md`) into Tailwind v4
  `@theme` tokens in `app/globals.css`: full color palette, fluid `clamp()` type
  scale, radii, warm shadows; runtime-switchable `--accent` / `--radius`; base reset,
  `::selection`, chat-pulse keyframes, and a `prefers-reduced-motion` guard.
- Authored the full Prisma schema (`prisma/schema.prisma`) covering services/CMS,
  e-commerce, booking, staff scheduling, CRM, blog, chatbot, GDPR/audit: **no
  migration run** (live DB deferred to Phase 2/3). Added `lib/db.ts` singleton.
- Added `content/site.ts` (brand + real Helsinki NAP + nav), `.env.example`,
  `.prettierrc`, npm scripts (`format`, `db:*`).
- Git: initialized repo; git-ignored the two reference folders
  (`design_handoff_mone_beauty_clinic/`, `scraped_content/`) and `.env*`.
- Verified: `prisma validate`, `prisma generate`, and `next build` all pass.

### Phase 1: MVP marketing site (tri-lingual)

- **i18n**: `next-intl` routing for `en` / `fi` / `ru` with locale-prefixed routes,
  `proxy.ts` (Next 16) middleware, `hreflang` alternates, and a header language
  switcher that preserves the current path. Message catalogs for all three locales
  (EN complete; FI/RU best-effort, flagged `[TODO: clinic review]`).
- **Design-system components**: `Button` (4 variants), `Eyebrow`, `SectionHeading`,
  `Card`, `FeatureItem`, `ImageSlot`, `Container`, `LanguageSwitcher`, `ChatWidget`
  FAB, Phosphor thin icons: built to the `01-design-system.md` tokens. Plus a
  `/styleguide` reference page.
- **Layout shell**: sticky blurred `Header` with desktop nav + `<900px` `MobileMenu`,
  dark 4-column `Footer`, chat FAB: wired into the locale layout.
- **Homepage**: Hero + 5-item advantages strip, TreatmentsGrid, AboutBlock, TechWall,
  dark CTABand, FeaturesStrip: recreated from `03-homepage-spec.md`.
- **Service pages**: one `ServiceTemplate` (13 content blocks) driving all **9
  treatments** at `/services/[slug]` (+ services index), with content seeded from
  `scraped_content` where it maps and `[CLINIC TO PROVIDE]` fallbacks elsewhere. No
  invented medical claims.
- **Marketing & legal**: About, Pricing, Contact (form preview + map + GDPR consent),
  Blog (+ article route, empty state), Booking placeholder, and Privacy / Terms /
  Cookies pages: all localized.
- **SEO**: per-page metadata + `hreflang`, `MedicalProcedure` / `FAQPage` /
  `BreadcrumbList` JSON-LD on service pages, `MedicalClinic` JSON-LD with the real
  Helsinki NAP on the homepage, `sitemap.xml`, and `robots.txt`.
- Added Prettier config + `.prettierignore`; ESLint ignores the reference folders.
- Verified: `next build` (all routes prerendered across 3 locales), `next lint`, and
  a production-server smoke test (locale redirect, FI/RU rendering, JSON-LD, sitemap).
