# Implementation Plan: Mone Beauty

## Independent admin and client sessions (owner-approved 2026-08-27)

- Add explicit `client` and `backoffice` authentication audiences backed by separate versioned,
  production-safe cookies while retaining the existing `Session` rows and 14-day lifetime.
- Route public account, verification, booking, checkout, order, and client-action consumers through
  the client audience. Route admin/staff login, forced password replacement, actions, pages, APIs,
  and logout through the back-office audience.
- Infer API audience only for exclusive client or back-office role guards and fail closed for mixed,
  empty, or ambiguous role sets. Revalidate active status and current role on every session read.
- Preserve active deployments through a temporary role-checked fallback to the shared
  `mone_session_v2` cookie when no scoped cookie exists. Do not clear it on login; on logout remove
  it only when it belongs to the same audience.
- Verify both login orders and independent logouts in one browser, legacy-cookie continuity,
  audience/role mismatch rejection, account auto-login paths, guards, booking/checkout, admin APIs,
  focused and complete tests, lint, typecheck, and production build. Remove the fallback in a later
  release after legacy sessions have naturally expired.

## Consultation during first booking and account reconciliation (owner-approved 2026-08-28)

- Pass a serializable localized consultation configuration and the authenticated client's own
  readable saved answers into the four-step booking wizard; collect required consultation data in
  You/Confirm for every guest and only missing/stale/unreadable signed-in profiles.
- Extend booking creation with live content-version validation, birth-date and keyed-answer
  validation, fail-closed AES-256-GCM encryption, an atomic profile upsert, distinct health,
  accuracy, GDPR, and procedure consent snapshots, and appointment creation.
- Keep sensitive plaintext out of appointment snapshots, API responses, notifications, logs,
  audit metadata, and chatbot data. Preserve editable ordering, archival, stricter-version
  invalidation, wording snapshots, GDPR export, and erasure.
- Extend verified email/guarded-phone reconciliation to select the newest readable consultation,
  relink consultation and appointment consents, remove superseded guest profiles, and emit
  value-free match-method audits.
- Allow current decryptable appointment-claim profiles to replace duplicate registration health
  questions with a locked claim email; defer profile transfer until verification and fall back to
  the ordinary consultation form for invalid, stale, ambiguous, or unreadable claims.
- Verify focused consultation/reconciliation behavior, complete tests, lint, typecheck, production
  build, migration status, health behavior, and FI/EN/RU booking/claim routes at mobile and desktop.

## Online booking specialist selection and consultation profiles (owner-approved 2026-08-26)

- Supersede automatic assignment with **Procedure -> Specialist -> Date & Time -> You/Confirm**.
- Add public names, exact option qualifications, `Appointment.reservedUntil` and buffer cutover,
  separate client names, localized versioned consultation questions, one encrypted current profile,
  and immutable purpose-specific consent snapshots.
- Add required AES-256-GCM helpers that fail closed and exclude plaintext sensitive data from logs,
  notifications, audit metadata, and chatbot knowledge.
- Ship a guarded idempotent Irene-to-Irena roster/qualification backfill and a dry-run future-gap
  preflight that blocks activation until future sub-15-minute conflicts are resolved.
- Reserve practitioners, rooms, and devices through visible end plus 15 minutes in every create,
  move, reschedule, block, and approval path; retain visible end and show the buffer only internally.
- Add the minimal specialists endpoint, specialist-filtered dates/slots, URL/locale preservation, and
  atomic revalidation of qualification, capability, working coverage, blocks, resources, buffer,
  and procedure consent.
- Update the localized mobile-first wizard for zero/one/many specialists, guest compatibility,
  authenticated saved identity and consultation gating, and public specialist summaries.
- Expand registration and `/oma-tili`; add shared-admin consultation/wording management and staff
  option qualifications with locale completeness, versioning, archival, future-booking guards,
  audited authorized decryption, GDPR export, and erasure.
- Verify scheduling, qualification, form types/versioning, encryption, consent, RBAC, audit,
  export/erasure, guest behavior, concurrency, and 390/768/900/desktop accessibility; then run lint,
  typecheck, tests, build, migration preflight, and PostgreSQL concurrency smoke testing.
- Activate only after configuring `SENSITIVE_DATA_ENCRYPTION_KEY`, clearing preflight, migrating and
  reviewing preserved qualifications, and obtaining clinic/legal approval of localized wording.

## Booking flow, buffer, and "Any Specialist" (owner-approved 2026-09-08)

- Reorder the public wizard to **Procedure -> Date -> Specialist -> Time -> You/Confirm** per the
  "Booking System Requirements & Clarifications" document: `GET /api/booking/specialists` now
  requires `date` and returns only practitioners qualified for the option who also have an open
  slot that day (`qualifiedSpecialistsForDate` in `lib/booking.ts`). Deep links begin at Date.
- Drop the internal buffer from 15 to 10 minutes everywhere, with no per-treatment exceptions, and
  migrate existing future bookings to match.
- Cap shared equipment (Endospheres, Laser, Microneedle RF) at the clinic's one physical unit each;
  stop treatment rooms from gating online availability at both the app and database level.
- Add an "Any Specialist" no-preference choice (offered whenever 2+ specialists qualify for the
  selected date) resolved to one concrete practitioner via `POST /api/booking/resolve-specialist`
  at time-of-slot-pick: compact scheduling first, workload balancing second: shown to the client
  before confirmation.

## Endospheres booking handoff (owner-approved 2026-08-13)

- Give the Endospheres landing CTA dedicated FI/EN/RU heading/action copy and explicitly retain the
  active locale in its `/ajanvaraus?service=endospheres` link.
- Resolve an explicitly linked published hidden parent service without making it visible in the
  general picker. Present its published options as an explicit choice and do not auto-select an
  Endospheres duration.
- Carry localized service-image alt text in booking context. Use the selected service image and focal
  position in the booking-page visual, falling back to the global booking hero only when the selected
  context has no valid image.
- Add no schema, migration, scheduling, availability, or booking API changes. Verify FI/EN/RU links
  and copy, Endospheres/laser/other selected imagery, hidden-service picker isolation, direct fallback,
  390 px and desktop layout, focused/full tests, lint, typecheck, production build, and diff checks.

## Body Treatments Endospheres mirror (owner-approved 2026-08-13)

- Keep the dedicated Endospheres page unchanged and resolve the Body Treatments landing through the
  same exact-locale published Endospheres service record.
- Mirror the complete Endospheres page: hero, H1, summary, overview, structured editorial and managed
  imagery, booking CTA, treatment/course cards, option-detail links, and conditional before/after
  gallery. Use the Endospheres service identity for booking and option links.
- Remove the appended-content component and all Body Treatments-specific landing content. Preserve the
  Body Treatments navigation/service-index link and its database records and option-detail routes.
- Use Endospheres metadata, social image, JSON-LD, canonical, and hreflang for the mirror. Exclude only
  the Body Treatments landing from the sitemap. Return 404 when the requested locale's Endospheres
  record is missing or unpublished, without locale or Body Treatments fallback.
- Add no schema, migration, API, route, or admin-editor changes. Verify FI/EN/RU parity and isolation,
  metadata/structured-data/sitemap behavior, managed media, CTA and option identities, one H1, keyboard
  focus, reduced motion, 390 px and desktop layouts, focused/full tests, lint, typecheck, and build.

## Shared staff/admin back office (owner-approved 2026-08-01)

- Route active permanent-password staff into localized `/admin` and reuse the complete admin
  shell, modules, actions, and APIs. Keep `/henkilosto` as an authenticated compatibility redirect
  while retaining its login and forced-password routes.
- Grant staff all administrator capabilities, removing own-employee/calendar restrictions. Keep
  raw Audit Logs, global Integration Logs, and audit export administrator-only; record-specific
  delivery history remains available.
- Add localized staff-only My settings inside the shared sidebar for the existing self-service
  account/profile/schedule/capability workflow. Preserve forced password replacement, disabled
  account rejection, session rotation, validation, concurrency, and staff-attributed auditing.
- Update role-boundary, routing, locale, responsive-shell, API, full-suite, and production-build
  verification. No schema or data migration is required.

## Admin-managed public imagery (owner-approved 2026-08-01)

- Persist all visitor-facing content imagery with shared FI/EN/RU selection, localized alt text,
  decorative state, and 0–100 focal points; keep brand/system assets and the homepage video code-owned.
- Extend entity editors with primary/hero/treatment/cover controls and add named Content editors for
  homepage, booking, Endospheres editorial, Markdown imagery, and default social media.
- Backfill the exact current visuals, resolving every treatment option through the existing media
  precedence and consolidating localized legacy media FI → EN → RU. Keep rollout additive and guarded.
- Route visible images, cards, booking/basket surfaces, sitemap, JSON-LD, and social previews through
  the same managed values. Stop ordinary or forced text sync from replacing admin-selected media.
- Verify required/optional rules, upload RBAC and validation, focal crops, localized alt text,
  migration dry-run/idempotency, 390/1440 layouts, lint, types, complete tests, and production build.

## Category overview, editorial, and quick-book upgrade (owner-approved 2026-08-01)

- Populate every localized category `whatItIs` with two or three concise paragraphs grounded in
  the matching scraped locale, retaining guarded authored copy for injectable medicine and medical
  consultation. Update only empty or exact known imported aggregates so admin edits survive.
- Keep `shortDesc` in the hero only. Render `whatItIs` below with a localized heading and editorial
  split, remove repeated summaries from category and treatment-detail bodies, and keep other
  categories concise.
- Render Endospheres long-form content as structured localized sections after the treatment grid,
  using alternating heading/content columns, benefit grids, and at most three real 4:3 images with
  a 420 px desktop height cap.
- Add `COURSE` to `ServiceOptionType`. Convert the eight Endospheres PDF packages and all canonical
  Packages entries to published, duration-backed courses while preserving stable keys, localized
  catalogs, booking-service targets, resource allocation, prices, and legacy procedure links.
- Treat every published active appointment/course as bookable. Enforce duration validity in the
  schema, booking APIs, calendar flows, and admin editor. Continue reserving only the first course
  visit and explaining that later sessions are arranged with the clinic and paid at the clinic.
- Group cards by localized treatment group. Use equal grid rows, complete unclamped copy, aligned single-line
  duration/price metadata, a stretched detail link, and an independent localized quick-book button.
  Use subtle warm hover elevation without border changes, visible focus, and reduced-motion support.
- Verify the guarded migration in dry-run/apply modes, all published option identities and booking
  paths, 390 px and 1440 px layouts, accessibility, lint, types, complete tests, and production build.

## Treatment detail restoration (owner-approved 2026-08-01)

- Refresh the FI/EN/RU live service-page scrape and generate a committed, source-attributed
  treatment-detail registry containing each locale's complete treatment/course Markdown.
- Extend normalized option content with a complete extractive same-locale paragraph or semantic list block, full description,
  source URL, and scrape date. Keep these fields admin-editable and never fall back across locales.
- Render category cards as text-only links to dedicated treatment pages. Add localized treatment
  detail routes with real media, breadcrumbs, full Markdown, practical content, booking/contact
  actions, course first-visit notices, metadata, canonical/hreflang, Service JSON-LD, and sitemap.
- Guard database synchronization: match ordinary options by localized identity plus legacy index,
  Packages by semantic key, populate only empty/known source-owned values, preserve admin drift,
  locale-only/archive state, stable identity, booking duration, price and resource targets, and
  keep only genuine overview content in category-level `whatItIs`.
- Verify scrape/registry parity, locale isolation, stable and legacy booking handoffs, option route
  eligibility and SEO, migration dry-run/idempotency, 390 px/accessibility/reduced motion, booking
  resource/duration/overlap regressions, lint, typecheck, full tests, browser checks, and build.

## Complete localized treatment clinical copy (owner-approved 2026-08-01)

- Publish localized Markdown for all 123 treatment options and 367 FI/EN/RU records, preserving
  each existing opening description, option identity, name, group, duration, price, booking
  duration, publication state, route, media, and booking handoff.
- Add seven non-empty sections to every record: what it is/how it works, suitability, benefits,
  expected results and recommended course, safety/contraindications, preparation, and aftercare;
  add FAQ only where supported and useful.
- Keep a committed localized enrichment registry and option-level provenance manifest. Use clinic
  documents first, then existing same-locale Mone Beauty copy, official manufacturer material,
  and authoritative medical/public-health sources. Prose and translations may organize those
  facts but may not add unsupported medicines, dosages, credentials, guarantees, claims, or prices.
- Reuse sourced family copy for laser areas, RF areas, Endospheres durations, and course variants.
  For packages and unspecified injectable options, defer procedure-specific suitability, safety,
  and contraindications to the individual assessment rather than inventing a universal list.
- Extend guarded synchronization so empty and known source-owned descriptions advance to the new
  enriched source version while later admin-edited descriptions remain unchanged.
- Verify complete localized section/provenance coverage, complete-block extractive summaries, immutable
  option metadata and booking links, guarded sync behavior, content checks, tests, typecheck, lint,
  production build, and representative 390 px/desktop pages in all locales.

## Cancellation policy publication (client-approved 2026-07-31)

- Centralize the approved 24-hour cancellation and rescheduling policy in FI/EN/RU and use it
  in booking, appointment emails, secure management, client accounts, clinic rules, and Terms.
- Charge 50% for changes made less than 24 hours ahead but before the appointment date, and
  100% for same-day changes or no-shows; link compact notices to the full localized policy.
- Keep online cancellation and rescheduling available. Fee administration stays manual and
  appointment payments remain outside Stripe.
- Apply a guarded content migration to the existing database-owned clinic-rules copy and keep
  generated-content imports aligned without modifying the scraped source registry.

## Endospheres content, pricing, and booking upgrade (client-approved 2026-07-30)

- Treat the two repository-root July 2026 Endospheres PDFs as the newest English content
  and pricing authority; render both canonical Endospheres routes from one dedicated,
  mobile-first component.
- Keep the existing FI/RU pages published and isolate new FI/RU translations as
  review-only drafts until clinic approval.
- Add fixed-price €99 introductory 75-minute and €65/€85/€105/€125 regular
  30/45/60/75-minute services under the `endospheres` booking family. Copy the parent's
  employee, room, and device capabilities and hide the generic parent from the picker.
- Publish the matching single and 6/12-session prices in the database-owned global price
  list. Packages remain clinic-paid and outside Stripe.
- Require a signed-in client account for every offer. Enforce new-Endospheres-client
  eligibility by normalized email or phone inside the serializable booking transaction;
  cancelled appointments do not consume eligibility.

## Complete source-copy restoration and reproducible archive (owner-approved 2026-08-01)

- Generate treatment summaries from exactly the first complete coherent same-locale paragraph or semantic
  list block. Benefits, advantages, results, course, safety, and other structural headings remain below the
  hero. Never insert terminal ellipses or truncate treatment names/copy with visual line clamps; retain the
  complete description on the detail page after consuming its complete matching Markdown prefix, including
  multi-block/list summaries.
- Guard synchronization so empty and exact known source-owned legacy/current summaries advance while
  unrelated admin-edited summaries remain unchanged.
- Reproducibly crawl the legacy sitemap and same-origin canonical links into a temporary staging directory,
  require 153 canonical pages (51 per FI/EN/RU), 31 catalog products per locale, non-empty raw HTML and
  Markdown, locale/product parity, and complete media-reference coverage before replacing the git-ignored
  local archive.
- Store raw HTML, complete semantic Markdown, media assets, and page/URL/media/status/MIME/size/SHA-256
  manifests. Preserve failed media references explicitly. Commit the reusable crawler/converter and tracked
  generated registries/provenance, while `scraped_content/` remains local and ignored.
- Apply the PDF-controlled Endospheres single and 6/12-treatment matrix consistently in every locale,
  including 60 min / 12 treatments at €1,050 and 75 min / 12 at €1,250. Keep the €99 introductory
  75-minute Full Body offer, account/eligibility rules, at-clinic payment, duration-area guide, and the
  12-treatment cadence recommendation consistent across content, pricing, booking, migrations, and tests.

## Employee self-configuration and unified staff management (owner-directed, 2026-07-22)

- Add versioned staff-owned and admin-targeted configuration APIs backed by one validation and
  persistence service, including current-password email changes and session revocation.
- Consolidate employee Account, Profile, Schedule, exceptions, and Booking Capabilities in
  Admin -> Staff; add the same permitted self-service settings to `/henkilosto`.
- Introduce and backfill `PractitionerServiceCapability`, preflight future appointments, then
  retire the implicit practitioner/service relation and allocate only exact capability tuples.
- Keep global service room/device pools and block templates in Calendar Setup, with employee
  editing and qualifications removed from that screen.
- Enforce optimistic versions, future-appointment guards, ownership/RBAC, normalized unique email,
  complete FI/EN/RU UI, and successful/denied audit metadata.
- Verify database-backed migration/concurrency, unit tests, lint, production build, and 390px
  responsive behavior.

## Complete scheduling clashes and staff settings (owner-directed, 2026-07-22)

- Upgrade weekly employee schedules to independent, split-capable 15-minute weekday intervals
  interpreted in `Europe/Helsinki`, while preserving explicit per-date overrides and legacy data.
- Centralize public/internal availability in a batched allocation engine that enumerates every
  qualified employee, allowed room, and required-device combination and uses the same rules for
  booking, moves, and approved reschedules.
- Recalculate allocation inside sorted advisory locks, exhaust alternate combinations, and retain
  PostgreSQL employee/room/device exclusion constraints.
- Give admins complete employee/resource/service configuration and staff only their own schedule,
  exception, block, and preference controls; reject configuration changes that invalidate future
  appointments.
- Keep one employee, one service, one room, and zero/one device per appointment until the clinic
  answers the multi-employee/sequential-treatment question; keep engine interfaces extensible.
- Full specification: [`SCHEDULING_CLASH_IMPLEMENTATION_PLAN.md`](./SCHEDULING_CLASH_IMPLEMENTATION_PLAN.md).

## Stripe website payments (owner-approved, 2026-07-19) ✅ implemented

- Replace unpaid order requests with Stripe-hosted Checkout for website-originated physical
  products, gift cards, and prepaid treatment vouchers; retain server-owned prices and GDPR
  checkout consent.
- Reconcile payments, delayed methods, expiry, and full/partial refunds through signed,
  idempotent Stripe webhooks and durable Prisma payment/event records.
- Secure Stripe's return link with a per-attempt hashed cancellation token, explicitly expire
  abandoned Sessions, and expose a localized Awaiting payment admin badge/filter.
- Add free clinic pickup or one Dashboard-managed Finland shipping rate, automatic balance
  gift cards and single-use treatment vouchers, admin redemption/refunds, and localized
  payment/fulfilment/refund notifications.
- Keep appointment booking entirely outside Stripe: in-person appointments are paid at the
  clinic and never receive Stripe invoices or follow-up charges.

## Account portals, staff RBAC, and audit (owner-approved, 2026-07-19) ✅ implemented

- Add optional verified client accounts under `/oma-tili`, secure guest-appointment claims,
  isolated past/upcoming procedure history, and admin-reviewed change requests.
- Add separate staff login, admin-managed temporary credentials, forced first-login password
  replacement, account disable/reset/session revocation, and no staff confirmation email.
- Give staff the full shared back-office capability set after forced password replacement.
- Keep only raw Audit Logs, global Integration Logs, and audit export admin-only at the server
  boundary.
- Add admin staff management and immutable security/access audit views with filters and CSV
  export; retain audit records until a legally reviewed clinic policy replaces that default.

## Shared employee calendar (owner-approved, 2026-07-19) ✅ implemented

- Add localized `/admin/kalenteri` navigation and reuse the calendar presentation at
  `/henkilosto` with role-specific data and controls.
- Replace the synthetic default-provider assignment with four real, ordered qualified employees;
  public booking assigns the first conflict-free employee in display order while preserving
  historical relations and keeping employee identity out of the customer flow.
- Add admin setup for employees, working hours, rooms, physical devices, and service/resource
  mappings.
- Render Timma-inspired day/week/month views with all employees visible, availability
  backgrounds, client/procedure/room/time cards, and confirmed drag-to-move behavior.
- Add a persistent Create appointment action and empty-time click creation with CRM client
  search/inline creation, confirmed staff bookings, lifecycle editing, auditing, and localized
  durable notifications. Existing-client lookup uses a searchable dropdown with 300 ms debounced
  name, phone, or email queries and no manual search button. Show the 20 most recently updated
  active clients when opened, keep editable name/phone/email fields visible, support keyboard
  clearing, and persist booking-only appointment contact snapshots without mutating CRM details.
- Enforce employee, room, and device overlap protection in shared booking logic and PostgreSQL.
- Persist canonical weekly hours on each employee, batch-resolve working dates, crop shared
  day/week grids to the selected employees' open-time union, and disable unavailable picker dates.
  Scheduling time controls expose open covered slots only; the hours editor retains a full-day
  override and out-of-hours legacy appointments remain visible in an exception row.

## Timma-style calendar and internal blocks (owner-approved, 2026-07-21) ✅ implemented

- Rework `/admin/kalenteri` into a dense full-height day/week/month workspace with generated
  employee filters, sticky axes, bilateral time labels, union-of-working-hours cropping, month
  overflow, desktop-fit day/week columns, below-desktop horizontal scrolling, a desktop sidebar
  that expands over the reserved icon-rail layout, and persisted three-level zoom.
- Add a desktop draggable internal-service palette and mobile horizontal tray with selection plus
  click placement as the touch/keyboard fallback.
- Add localized `CalendarBlockTemplate`, `CalendarBlockSeries`, `CalendarBlock`,
  `CalendarBlockItem`, and `CalendarBlockParticipant` Prisma models and seed the five approved
  60-minute templates separately from clinical services.
- Implement the localized Booking info modal, sequential items and duration math, optional single
  room/device reservation, weekday recurrence, occurrence preview, 12-month/500-occurrence
  limits, admin multi-employee and staff-own-only permissions.
- Add atomic block create/update/cancel APIs with occurrence/future scope, soft cancellation,
  optimistic versions, audit logging, and admin-only template configuration.
- Centralize appointment/block employee, room, and device conflict checks and PostgreSQL advisory
  locks; apply them to public and internal appointment creation and rescheduling paths.
- Cover recurrence, snapping, durations, localization, limits, RBAC, concurrency, availability,
  automatic practitioner roster population, responsive interaction, lint, typecheck, and build.
- Replace the granular Open / closed times modal with localized, tooltiped Add/Remove workday
  controls. Persist exact per-date availability overrides, protect active appointments, retain
  weekly hours, and use magnifying-glass icons plus accessible tooltips for calendar zoom.

## Timma employee roster and palette fidelity (owner-approved, 2026-07-21)

- Replace the visible synthetic clinic employee with Ilona Bagaturija, Irene, Vladislava, and
  Inna; provision linked staff accounts, stable calendar colors, and employee-filter persistence.
- Generate the full 119-entry Finnish internal-service catalog from `internal-services.txt`, keep
  the first four selected by default with all remaining rows unselected, and add a per-user Edit dialog for up to 24 visible,
  ordered, 14-character shortcuts in the desktop rail/mobile tray.
- Localize all 119 catalog names and drag aliases in English and Russian while preserving the
  Finnish source unchanged. Localize every palette-dialog control and accessible name, store
  independent FI/EN/RU shortcut aliases, and migrate existing Finnish-only preferences without
  losing visibility or order.
- Drop internal services onto exact 15-minute positions within visible hourly rows and open the reference-style Booking info
  editor prefilled with service, employee, date, start/end, resource, notes, and recurrence.
- Keep full Monday-first weeks, render vacant one-hour rows with a 10:00–19:00 empty-grid
  fallback, expose quarter-hour targets only on hover/drop, add a visible drag overlay, and
  compact the service/employee tiles.
- Remove nested Day/Week vertical scrolling, keep every Month date navigable, and add accessible
  vertical quarter-hour selection locked to the starting date/employee. Render the selection as
  one continuous borderless-interior block and open Create appointment immediately with the
  dragged duration; keep internal blocks and per-date workday controls available in the toolbar.
- Aggregate public availability across the ordered qualified roster and allocate the first
  conflict-free employee/resource atomically without exposing employee identity publicly.

## Professional admin visual system (owner-approved, 2026-07-21)

- Isolate admin login and operational screens on Inter with complete FI/EN/RU coverage, a compact
  semibold heading hierarchy, restrained labels/actions, and tabular operational data while
  preserving the public Cormorant/Jost system.
- Standardize admin and shared operational controls on Phosphor Regular icons, bold active states,
  consistent size tiers, 44 px icon buttons, localized labels/tooltips, and no text-glyph control
  substitutes.
- Verify sidebar states, dashboards, CRUD modules, logs, calendar/setup, appointment forms, and
  modals across mobile/desktop and all three locales.

## Client account and integration observability expansion (owner-approved, 2026-07-19)

- Redesign `/oma-tili` into overview, appointments, orders, addresses, and profile views; expose
  verified identity details, audited profile edits, paginated history, and secure order ownership.
- Add reusable Finland saved addresses and authenticated booking/checkout prefilling. Preserve an
  immutable order address snapshot and never write Stripe's final address back to the address book.
- Render rich localized booking emails with appointment, practitioner, clinic, policy, map,
  calendar, pay-at-clinic, and secure management details.
- Add redacted durable request/response attempt logs for messaging, Stripe, Anthropic, and
  Cloudinary, an admin viewer, and a daily 30-day cleanup command.

## Automatic guest-history linking and order cancellation requests (owner-approved, 2026-08-01)

- Add indexed normalized email/phone snapshot keys to orders and appointments, backfill them with
  shared application normalization, and maintain them in checkout plus every booking/calendar
  appointment mutation path.
- Reconcile guest orders and appointments after verification and every client login in one
  idempotent transaction. Match verified email or account phone, protect another verified email's
  ownership, never transfer registered-account records, move appointment change-request ownership,
  preserve snapshots and unrelated CRM/clinical data, and audit record type plus match method only.
- Retain single-use appointment claims for historical emails while making them idempotent and
  ownership-safe.
- Add database-enforced single-pending `OrderCancellationRequest` records with localized account
  submission/status UI and admin Orders filters plus approve/reject controls; do not grant staff
  order access.
- Revalidate ownership and order state on approval. Expire open unpaid Stripe Checkout, cancel
  unpaid legacy orders, or idempotently refund the full remaining paid balance. Keep webhook
  reconciliation, voucher invalidation, order-state messages, and integration logs authoritative;
  provider failures preserve retryability and order state.
- Verify matching/precedence/concurrency and snapshot preservation; account/admin RBAC and stale
  states; unpaid expiry and paid/partial refund flows; webhook/voucher/audit/notification behavior;
  FI/EN/RU pagination, 390 px accessibility, migration, lint, typecheck, tests, and production build.

## Superseded public specialist selection removal (owner-approved, 2026-07-17)

The public wizard is **Service -> Time -> You**. Contextual links and valid homepage
handoffs open directly at Time; service changes retain the chosen date, clear the slot, and
reload availability. Public slot lookup and appointment creation ignore legacy
practitioner values and resolve the exact **Mone Beauty Clinic** scheduling resource
server-side, connecting it to the requested bookable service when needed. Practitioner IDs
remain stored only as an internal persistence relation for availability and overlap
prevention. The obsolete practitioner endpoint and every practitioner selector are removed;
historical appointment relations remain intact. No Prisma migration is required.

## Themed form controls (owner-approved, 2026-07-18)

All form dropdowns use the shared themed listbox, and all date/time selection uses the
booking-style calendar and time chips. Compact admin, staff, and homepage fields open the
calendar in a popover; the main booking calendar remains inline. Native select/date/time
controls are not used in application forms.

## Homepage reference match (owner-approved, 2026-07-12)

The localized homepage uses `index.html` as its superseding visual/content specification,
including its owner-approved medical and licensing language. It retains the production cart,
localized routes, booking handoff, legal links, and GDPR/AI chat beneath that presentation.

## Finnish public route migration (owner-approved, 2026-07-17)

Use the same Finnish path segments in FI/EN/RU for every user-facing route. Move public pages
to the canonical Finnish IA, permanently redirect the legacy English IA, migrate Prisma
service/technology `publicPath` values, and update navigation, content links, notifications,
SEO, sitemap, and revalidation. Keep `/api`, `/admin`, dynamic product/article slugs, record
IDs, and booking query values stable. The header cart links to `/ostoskori` and displays the
persisted total quantity.

> Binding build roadmap. Pairs with [`REQUIREMENTS.md`](./REQUIREMENTS.md). Phases run in
> order; each builds on the last. **Commit after each phase.** Key direction: the app
> realizes the **client brief** (`SCOPE.md` = **Mone Beauty Clinic**, aesthetic medicine);
> `SCOPE.md` governs brand/positioning/IA/features, the design handoff supplies visual
> styling + structure, and **existing-page copy, images, and video come from
> `scraped_content/`**. **Prisma + custom admin (no Payload)**; **e-commerce is in scope**.
> **Current operations milestone: admin Orders + Appointments.** The dashboard and sidebar
> route to dedicated Finnish-segment queues, lifecycle actions are audited, checkout/booking
> receipts are distinct from clinic confirmation, and Resend/Sinch delivery attempts plus
> custom transactional messages are retained per record.
>
> **Current completed milestone: Stripe website payments.** Hosted Checkout, webhook payment
> reconciliation, vouchers, pickup/shipping, refunds, and notifications are implemented;
> live Stripe Dashboard configuration remains a deployment task.

## Phase 10: service treatment cards, detail pages, and normalized options ✅ implemented

- Render `/palvelut/*` as one hero image, short approved overview, responsive text-only
  treatment/course cards with individual stable detail links, then benefits, results, safety,
  aftercare, and FAQ. Keep `/laitehoidot/*` and `/trikologia` on their existing selector variant.
- Add localized normalized service options with stable keys, server-owned maximum booking
  duration, publication/archive controls, and appointment/package semantics. Backfill them from
  the existing locale catalogs without cross-locale fallback.
- Store a same-locale extractive card summary, complete source Markdown, source URL, and scrape
  date for every published option; expose those fields in admin without overwriting admin edits.
- Add `/palvelut/<service-slug>/<option-key>` with strict service/locale/publication resolution,
  real media, breadcrumbs, full description, course notice, booking/contact action, metadata,
  canonical/hreflang, Service JSON-LD, locale-aware switching, and sitemap coverage.
- Add appointment option relation and immutable duration/title/price snapshots while retaining
  legacy procedure fields and resolving old `procedure=<index>` links.
- Make booking context, availability, creation, rescheduling, staff/admin appointment editing,
  calendar rendering, and notifications resolve selected options server-side. Reject client-owned
  durations/prices and non-bookable or mismatched options.
- Extend the service admin editor to all structured treatment fields and normalized options;
  remove obsolete per-treatment image controls from active editing without deleting history.
- Replace positional Packages options with a source-attributed semantic registry, first-visit
  durations, server-owned scheduling-service/resource targets, published course-price snapshots,
  locale-only entries, and guarded dry-run/apply archival of unchanged superseded records without
  overwriting unrelated admin edits.
- Verify FI/EN/RU locale isolation and exact catalog differences, stable/legacy deep links,
  Endospheres offer rules, first-visit scheduling/resource behavior, keyboard focus, one image and
  one `h1`, overview/card/detail order, full source descriptions, 390 px first, WCAG AA, reduced motion, lint, typecheck,
  tests, migration dry-run/idempotency, and production build.

## Phase 9: localized admin and database-owned content (in progress)

- Split locale routes into public and admin groups so the admin has its own HTML/application
  shell and never inherits public chrome, cart, chatbot, consent, or analytics.
- Use Finnish admin segments across FI/EN/RU: `asiakkaat`, `ajanvaraukset`, `tilaukset`,
  `palvelut`, `teknologiat`, `sisalto`, `tuotteet`, `hinnasto`, `artikkelit`,
  `keskustelut`, `kirjaudu`, and `uusi`.
  Permanently redirect legacy English admin URLs.
- Add the localized responsive admin sidebar/drawer, persistent desktop icon-rail collapse,
  `Admin` translations, context-preserving locale switcher, dashboard
  warnings/metrics/audits/quick actions, and localized CRUD.
- Evolve Prisma with `PublicationStatus`, strict per-locale publication, dedicated
  `Technology` content, localized pricing, archive metadata, extended service/product
  metadata, and deletion guards. Every mutation is authorized, validated, audited, and
  revalidated; media is restricted to `/media/**`.
- Replace runtime generated-registry reads with shared Prisma repositories for public pages,
  homepage, catalog, booking, pricing/blog consumers, notifications, and chatbot knowledge.
  Generated JSON becomes bootstrap/import-only. Routine sync is insert-only; `--force`
  explicitly refreshes existing imported records.
- Backfill existing localized content and real media. Verify migrations/seed, legacy
  redirects, locale isolation, CRUD/archive/delete/anonymization, booking/cart regressions,
  390/768/899/900/desktop sidebar access and persisted collapse, lint, type-check, tests, and
  production build.
- Migrate every public page to its canonical Finnish route, add locale-preserving 308 legacy
  redirects, and centralize paths so public navigation, SEO, email/chat links, and Prisma
  `publicPath` values cannot drift.

## Content & media pipeline (from the live site)

- `scripts/gen-content.mjs` parses `scraped_content/{en,fi,ru}/*.md` → committed
  `content/generated/{pages,products,assets}.json` (image srcs rewritten to `/media/...`).
- `scripts/copy-media.mjs` copies referenced assets + hero video + logo + favicon into
  committed `public/media/**`, `public/logo.svg`, `app/favicon.ico`.
- Page bodies render via `components/Markdown.tsx` (`react-markdown` + `remark-gfm`).
- `scraped_content/` stays git-ignored; re-run both scripts to refresh content/media.

## Stack (locked)

Next.js (App Router) · TypeScript · Tailwind (tokens from `01-design-system.md`) · Prisma ·
PostgreSQL · `next-intl` (ru/fi/en) · `@phosphor-icons/react` (thin) · `next/font`
(Cormorant Garamond + Jost) · Anthropic Claude API · Resend/Postmark (email) · Twilio/FI
gateway (SMS) · GA4 + Search Console + `next-sitemap`.

## Project structure (target)

```
app/
  [locale]/
    page.tsx (home), about, instrumental/[slug], trichology, arosha,
    services, services/[slug], catalog, catalog/[slug], basket, booking,
    privacy-policy, terms-of-use, cookies-policy
    (later)     shop cart/checkout/order, account, staff
    (account)/    account            # client: appointments, orders, profile
    (staff)/      staff              # staff schedule
    (admin)/admin/                  # localized Finnish-path custom admin + CRM
  api/            booking, chat, checkout, webhooks (email/sms)
  styleguide/                       # component + token showcase
components/
  ui/        Button, Eyebrow, SectionHeading, Card, FeatureItem, ImageSlot,
             LanguageSwitcher, ChatWidget
  layout/    Header, Footer, MobileMenu
  marketing/ Hero, TreatmentsGrid, AboutBlock, TechWall, CTABand, FeaturesStrip
  shop/      ProductCard, ProductGrid, CartLineItem, CheckoutForm
  booking/   Wizard, Calendar, SlotPicker
  staff/     ScheduleCalendar, WorkingHoursEditor
  admin/     CollectionTable, RecordEditor, ClientSearch
lib/         tokens.ts, seo.ts, i18n.ts, db.ts (Prisma client), ai.ts (Claude client),
             auth.ts, mail.ts, sms.ts
prisma/      schema.prisma, seed.ts
messages/    ru.json, fi.json, en.json
content/     seed copy/images derived from scraped_content/
```

## Prisma data model (core entities)

```
User            id, email, passwordHash?, role(admin|staff|client), locale
Service         id, slug, publicPath, category, duration, bookable, priceFrom, images,
                order, archivedAt; locale TreatmentContent has DRAFT/PUBLISHED status
TreatmentContent serviceId, locale, h1, shortDesc, whatItIs, suitableFor[], benefits[],
                 processSteps[], safety, preCare, postCare, contraindications[],
                 sessions, results, faq[{q,a}], seo{title,description,ogImage}
Technology      id, slug, publicPath, images, order, relatedServiceId?, archivedAt;
                TechnologyContent(locale, name, specification, body, SEO, status)
Product         id, slug, size, price, currency, images[], category, order, archivedAt;
                ProductContent(locale, copy, image alt, SEO, status)
Cart / CartItem  cartId, productId, qty
Order / OrderItem id, clientId?, items[], totals, status, consent, createdAt
Practitioner    id, name, role, services[]
StaffUser       id, userId, practitionerId, workingHours, daysOff
Availability    practitionerId, date, slots[{start,end,status(open|closed|booked)}]
Appointment     id, clientId, practitionerId, serviceId, start, end,
                status(booked|confirmed|completed|cancelled|rescheduled), channel,
                notes, procedureIndex?, procedureTitle?, procedurePrice?, history[]
Client (CRM)    id, fullName, phone, email, appointments[], orders[], notes,
                contraindications(sensitive), consent{gdpr,marketing}, cancelHistory[]
Article         id, slug, cover, order, archivedAt; ArticleContent(locale, body, SEO, status)
PricingItem     serviceId?, category, price, order; PricingContent(locale,label,unit,status)
ChatSession     id, locale, messages[], handoffRequested, clientId?
Consent / AuditLog  actor, action, entity, at   # GDPR + medical-field audit
```

---

## Phase 0: Scaffold

Init Next.js (App Router) + TS + Tailwind + ESLint/Prettier. Add `next/font` (Cormorant +
Jost), `@phosphor-icons/react`, Prisma + Postgres (`DATABASE_URL`), `next-intl`. Translate
`01-design-system.md` into the Tailwind theme + CSS variables (`accent`, `--radius`); global
reset (box-sizing, `::selection` `#E7D9C4`, link color inherit) + `prefers-reduced-motion`
guard. **Verify:** `npm run dev` boots; theme tokens resolve; Prisma connects.

## Phase 1: MVP ⭐ (ship target)

**Goal:** tri-lingual, responsive marketing site, pixel-matched to the prototype.

- **UI primitives** (`components/ui`) + `/styleguide` page: Button variants, Eyebrow,
  SectionHeading, Card, FeatureItem, ImageSlot (`next/image`), LanguageSwitcher.
- **Layout shell + i18n**: Header (sticky, blurred, logo + nav + Book Online + switcher),
  MobileMenu (<900px hamburger), Footer (4-col + legal bar), ChatWidget FAB shell;
  `next-intl` locale routing (ru/fi/en); nav per `02-information-architecture.md`.
- **Homepage**: recreate `03-homepage-spec.md` exactly (Hero + 5 advantages, TreatmentsGrid,
  AboutBlock, TechWall, dark CTABand, FeaturesStrip); verify vs `assets/mone-*.png` at
  390/768/1280.
- **Service template + 9 treatments + `/services` index**: one template, 13 blocks (`04`),
  JSON-LD + hreflang; seed content from `scraped_content` per the §6 map, with any gaps governed
  by the current sourced clinical-copy policy above.
- **Remaining marketing**: About, Pricing, Contact (form + map + hours + consent), Blog +
  `/blog/[slug]`, legal pages.
- **Baseline SEO**: per-page title/meta/alt, ordered headings, real NAP.
- **Verify:** Lighthouse on marketing pages; visual diff vs PNGs; all three locales render.

## Phase 2: E-commerce (AROSHA shop) ✅ implemented

Canonical Finnish shop routes are used: `/verkkokauppa`, `/verkkokauppa/[slug]`,
`/ostoskori`, `/kassa`, `/tilaus/[id]`. The 31 products + images come from
`scraped_content` via the generated
registry. Cart state is client-side (`localStorage`), checkout captures GDPR consent,
server-side totals are recalculated from the product registry, and Prisma persists `Client`,
`Product`, `Order`, `OrderItem`, and `Consent`. Stripe payment capture, refunds, vouchers,
shipping/pickup, and paid-order notifications are completed in the Stripe milestone above.
**Verify:** browse → add to cart → checkout → order persists + confirmation page;
mobile layout at 390px.

## Lean Booking (one-click) ✅ implemented at reduced scope

**Goal:** the SCOPE.md priority: open the site, **select a service in one click, book fast**.
Ships ahead of the full Phase 3, reusing that data model at reduced scope.

- **Bookable-services registry** (`content/booking-services.ts`) derived from the existing
  real service pages; SCOPE extras (Injectable, Consultation) are bookable, with hand-authored
  category pages in `content/authored-pages.ts` and source-backed normalized option sections
  governed by the complete localized treatment-copy milestone above.
- **DB**: run `prisma migrate` against `DATABASE_URL`; `prisma/seed.ts` seeds one default
  `Practitioner` + `Service` rows from the registry.
- **Slots** (`lib/booking.ts`): simple business-hours slot generation minus already-booked
  `Appointment` starts (no per-practitioner `Availability` yet).
- **API**: `POST /api/booking` (upsert `Client`, create `Appointment` + `Consent`, reject
  double-book) and `GET /api/booking/slots`.
- **Wizard** (`components/booking/BookingWizard.tsx`): **Service → Time → You**, one-tap
  select-and-advance, `?service=<key>` preselect, GDPR consent, on-screen confirmation.
- **One-click entry points**: `Book` buttons on `/services/[slug]` + a home "Choose a
  service" selectable grid deep-linking `/booking?service=<key>`; trim homepage length.
- **Upgraded in Phase 3**: `Availability`-aware slots and lightweight reschedule/cancel
  endpoints while the public flow retains automatic clinic assignment. Email/SMS
  confirmations and reminders are
  implemented in Phase 6. **Verify:** e2e a booking persists; double-book rejected; 390px
  first.

## Phase 3: Booking (client wizard) ✅ implemented

Booking data model (Practitioner, Availability, Appointment, Client). Public wizard:
treatment → date/time (open slots only) → details (create/match client) → confirm + consent
→ confirmation. New public bookings use the exact **Mone Beauty Clinic** practitioner;
specialist selection and provider details are not exposed to customers.
Slot lookup uses `Availability.slots` when present, falls back to generated business-hours
slots while staff UI is absent, and rejects appointment overlaps. Lightweight
cancel/reschedule endpoints move actively rescheduled appointments onto the shared clinic
schedule and use the appointment reference + matching contact detail. **Verify:** slot generation, forced default
assignment despite forged practitioner input, double-booking prevention, e2e booking,
cancel, and reschedule.

### Dedicated booking routing and procedure context

- Route every active public Book/Book Online CTA to localized `/booking`; generic actions
  open service selection, service/technology actions pass `service`, and procedure cards pass
  a one-based `procedure` index.
- Centralize parsing of procedures from localized published service content. Resolve URL and
  API context against that shared source, never browser-supplied display values.
- Show the selected service/procedure summary above the wizard and preserve valid context on
  locale changes. Changing service clears procedure context and updates the booking URL.
- Hand the retained homepage form into the wizard once through expiring, versioned,
  tab-scoped storage; never place personal data in a URL.
- Persist nullable procedure index/title/price snapshots on `Appointment` and surface them in
  confirmation, staff schedule, CRM history, email/SMS reminders, and staff alerts, with
  service-only fallback for existing appointments.
- Verify generic/service/procedure/invalid URL paths, EN/FI/RU switching, 390px and desktop
  context cards, one-time/expired form handoff, server validation, migration, legacy
  appointments, formatting, lint, types, tests, and production build.

## Phase 4: Staff schedule (`/staff`) ✅ implemented

Internal staff schedule area: themed date selector, daily schedule view, working-hours
range editor, open/closed slot controls, and booked appointment details. Staff edits persist
to canonical `Practitioner.workingHours` plus generated `Availability.slots` and are reflected
in the client booking wizard. Calendars and scheduling pickers suppress non-working choices;
explicit per-date availability overrides weekly hours.
Staff/admin auth and role gating are implemented in Phase 5; staff new-booking
alerts are implemented in Phase 6.
**Verify:** staff edits availability → reflected in client wizard.

## Phase 5: CRM + custom admin + auth ✅ implemented

Custom Prisma-backed auth uses `User.passwordHash` plus durable `Session` rows and an
HTTP-only session cookie. Admin/staff roles are enforced: `/admin` is shared by both roles after
forced password replacement, while raw audit/integration logs and audit export remain admin-only.
`/admin` includes CRM client search/profile editing, audited
contraindication access/edits, service/product/pricing/blog management, and editable
`ContentPage` overrides seeded from generated scraped content. Public pages and catalog
prefer Prisma edits with generated JSON fallback. Staff-account creation automatically creates
and links the employee calendar profile. Admins can list all staff, reveal newly entered
temporary passwords, reset passwords, revoke sessions or access, reactivate accounts, inspect
audit history, and delete credentials without deleting clinical/calendar history. **Verify:** role gating enforced;
medical-field access audited; admin edits appear on site after migration + content sync.

## Phase 6: Notifications + reminders ✅ implemented

Email (Resend/Postmark) + SMS (Twilio/FI gateway). Booking confirmations (email + SMS,
SMS preferred) + reminders at 24h and 2h via a scheduled job; staff new-booking alerts;
order confirmations. Implemented with `lib/notifications.ts`, provider env configuration,
non-blocking booking/checkout notification sends, `AuditLog` delivery records, and
`npm run notifications:reminders` for cron/PM2 scheduling. Paid-order and refund messages
are extended by the Stripe website-payment milestone.
**Verify:** confirmation + scheduled reminder fire; consent respected.

Admin confirmation sends localized email and SMS for orders and appointments. Resend requests
use idempotency keys; Sinch Conversation API uses production OAuth. Outbound message content
and every provider attempt are stored for channel-specific retry without duplicating accepted
sends. Customer reschedule/cancellation and scheduled reminders share this history.

## Phase 7: AI chatbot ✅ implemented

Claude API integration with locale-matched RU/FI/EN responses, system prompt grounded in
approved CMS/generated content, product content, booking registry, and clinic contact facts.
The public chat FAB now supports GDPR consent, transcript persistence in `ChatSession`,
booking deep-links for detected services, and human handoff. `/admin/chat` provides the
handoff queue and transcript detail with resolve/reopen actions. **Verify:** answers from
content only; handoff creates an admin queue item.

## Phase 8: SEO + GDPR finalize ✅ implemented

`next-sitemap` XML sitemap + robots.txt; GA4 + Search Console; `LocalBusiness`/`MedicalClinic`
JSON-LD with Helsinki NAP + hours. Cookie-consent banner; data access/erase/export; EU
residency; SSL. Run Lighthouse and fix Core Web Vitals across marketing pages.
Implemented sitemap/robots hardening, richer `MedicalClinic` JSON-LD, GA4 loading gated by
cookie consent, localized cookie banner, non-placeholder legal pages, and admin GDPR client
export/anonymization tools. Lighthouse/Rich Results/Search Console validation remains a
deployment/manual verification task. **Verify:** sitemap valid; JSON-LD passes Rich Results
test; Lighthouse ≥ targets.

---

## Cross-cutting guardrails (every phase)

### Owner-approved homepage editorial redesign (2026-07-12)

Replace the original homepage composition with the `index.html`-inspired sequence: hero,
Standard of Care, clinical services, alternating technologies, product tabs, booking picker,
and clinic standard/contact. Use server-rendered sections with small tab and picker client
islands. Preserve real localized content/media, cart, booking, JSON-LD, shell, and a11y.
Verify at 390, 768, 900, and 1280 pixels.

- Match the prototype precisely (exact tokens; reference the PNGs): this is hi-fi.
- **Mobile-first**: verify at 390px first.
- **No invented medical content**: seed from scraped copy and the recorded source hierarchy.
  Where no scraped source exists, appointment framing and conservative sourced assessment/safety
  copy may be authored; unsupported procedures, medicines, dosages, indications, outcomes,
  prices, credentials, and guarantees remain prohibited.
- EU/GDPR for personal + medical data; strict access control.
- Performance: keep marketing pages SSG/SSR and lean; lazy-load images.
- Use real NAP from `scraped_content`; keep brand name in one config constant.
