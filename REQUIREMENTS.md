# Requirements: Mone Beauty

## Independent admin and client sessions (owner-approved 2026-08-27)

Client and back-office authentication must use distinct, audience-scoped, versioned cookies with
HTTP-only, SameSite=Lax, root path, 14-day expiry, and Secure plus `__Host-` naming in production.
Equivalent unprefixed cookies are used in development. Public pages and client APIs read only the
client audience; admin/staff pages and APIs read only the back-office audience. API role guards may
infer an audience only from exclusively client or exclusively admin/staff role sets and must reject
empty, mixed, or ambiguous sets. Every resolved session must match the audience, an allowed role,
active user status, and expiry. Logout removes only the selected audience so both accounts can stay
signed in concurrently in either login order.

Keep the existing `Session` schema and temporarily fall back to the role-checked shared
`mone_session_v2` cookie only when the requested scoped cookie is absent. Creating a scoped session
must not clear the shared cookie. Logout deletes and clears a shared session only when its user role
belongs to the requested audience, preserving an opposite-audience legacy session. User-specific
password reset and administrator revocation still invalidate all sessions for that user record.
Remove this compatibility fallback in a later release after pre-deployment sessions have expired.

## Consultation during booking and account reconciliation (owner-approved 2026-08-28)

Keep the four public booking steps. The final You/Confirm step must contain the live localized,
versioned consultation form whenever required. Guests must submit it on every booking. Signed-in
clients omit it only when their own encrypted profile is current and decryptable; otherwise they
complete it inline. The booking API must reload the live editable form, reject stale content
versions, invalid birth dates, missing required answers or acknowledgments, and unavailable
encryption, then atomically encrypt/upsert the profile, create separate health/accuracy/procedure
consent snapshots, and create the appointment. Health answers and birth dates must not enter
contact snapshots, responses, notifications, logs, chat, or audit metadata.

Only verified accounts receive guest history. Exact normalized email matches take precedence;
phone matches retain the existing verified-email conflict guard. Reconciliation chooses the newest
readable profile among the registered client and matched guest appointment clients, relinks their
consultation and appointment consents, deletes superseded guest profiles, and records only match
method and record type in audit metadata. Valid claim registration may omit duplicate consultation
fields only when the token is appointment-bound, its email is locked, and the guest profile is
current and decryptable. Transfer still occurs only after email verification. Every invalid,
expired, stale, ambiguous, or unreadable claim falls back to ordinary registration consultation.

## Online booking authority (owner-approved 2026-08-26)

The repository-root `online_booking_system_technical_requirements.pdf` supersedes all older public
automatic-assignment requirements. Booking is **Procedure -> Specialist -> Date & Time ->
You/Confirm**. Deep links preserve exact service/option and begin at Specialist. Return only active
practitioners explicitly qualified for that option and having a complete effective service,
room, and required-device capability. Select and skip when exactly one qualifies; require an
explicit selection when several qualify; provide no-preference nowhere; use the localized clinic
contact fallback when none qualify. Preserve `specialist` in localized booking URLs and locale
switches. Public APIs expose only `{id, name}` and never room, device, capability, or capacity data.

`Practitioner.publicName` supplies Ilona, Irena, Inna, and Vladislava. Exact
`PractitionerServiceOptionQualification` records are independent from resource capabilities.
Staff configuration rejects incomplete capabilities and removals that invalidate future bookings.
A guarded idempotent migration renames a unique Irene in place, creates missing practitioners
without credentials, and backfills qualifications without overwriting production configuration.

New and changed appointments reserve a 15-minute internal preparation/cleaning buffer.
`Appointment.end` stays customer-visible while `reservedUntil = end + 15 minutes` governs working
coverage, availability, locks, and practitioner/room/device conflicts. Internal calendars show a
distinct non-editable buffer. PostgreSQL range exclusions protect buffered records; a preflight
must stop rollout when future appointments have sub-15-minute gaps.

`GET /api/booking/specialists?service&option&locale` returns only `{id, name}`. Date/slot APIs
require `specialist`; booking creation requires `specialistId` and procedure-consent version. Every
availability response is `private, no-store`. The locked serializable transaction revalidates
activity, qualification, capability, schedule, blocks, resources, buffer, and consent version.

## Booking flow, buffer, and "Any Specialist" (owner-approved 2026-09-08)

The "Booking System Requirements & Clarifications" document supersedes this section's flow order
and buffer value above. Booking is **Procedure -> Date -> Specialist -> Time -> You/Confirm**: the
client picks a date before a specialist, and `GET /api/booking/specialists` requires `date` so only
practitioners who both qualify for the option and are actually on the schedule that day are
returned. Deep links preserve exact service/option and begin at Date, not Specialist.

The internal buffer is **10 minutes**, not 15, with no per-treatment exceptions
(`APPOINTMENT_BUFFER_MINUTES` in `lib/booking.ts`); existing future bookings were migrated to match.
Shared equipment (Endospheres, Laser, Microneedle RF) is capacity-limited to the clinic's one
physical unit each. Treatment rooms never gate online availability (app logic and the database
exclusion constraint were both dropped).

An "Any Specialist" no-preference choice is offered whenever 2+ specialists qualify for the
selected date; picking it defers assignment to `POST /api/booking/resolve-specialist` at
time-of-slot selection, applying compact scheduling (prefer someone already working that day) then
workload balancing (prefer the lightest 14-day load) among specialists still eligible for that
exact slot. The client sees the assigned name before confirming: the "no preference nowhere" rule
above now applies only to booking creation itself, since a concrete practitioner is always attached
to the appointment.

Guests retain contact inputs, GDPR consent, claims, and optional later registration. Authenticated
clients use server-owned verified contact data and require a current consultation profile.
Registration collects separate names, date of birth, configured localized answers, health-data
consent, and accuracy acknowledgment. `/oma-tili` supports completion/reconfirmation when stricter
required questions advance the required form version.

Questions are versioned, ordered, localized in FI/EN/RU, active/archived, and support short text,
long text, yes/no, single choice, multi-choice, and required acknowledgment. Choices use stable
localized keys. Admin manages questions/options and all consent wording but cannot publish
incomplete locales. One current profile per client stores encrypted date of birth and answer
snapshots. AES-256-GCM with required `SENSITIVE_DATA_ENCRYPTION_KEY` fails closed, and plaintext
health data never enters logs, notifications, chat, or audit metadata.

Health-profile consent, accuracy acknowledgment, and per-booking procedure consent remain distinct
immutable snapshots with appointment, locale, version, and wording. Authorized ADMIN/STAFF views
and mutations are audited; clients have self-access. GDPR export includes readable consultation
data and consent snapshots; erasure destroys the profile and redacts consent linkage while keeping
value-free security audits.

## Shared staff/admin back office (owner-approved 2026-08-01)

- Active staff who have replaced their temporary password use the localized `/admin` workspace
  with the same responsive sidebar and every administrator read/write capability.
- Staff are excluded only from raw Audit Logs, global Integration Logs, and audit export. Hide
  those destinations and reject direct access while retaining immutable staff-attributed logging.
- Keep record-specific delivery history visible within orders, appointments, and chats.
- Add localized staff-only My settings inside `/admin` for own email/password, profile, schedule,
  and capabilities; redirect authenticated `/henkilosto` traffic into the shared workspace while
  retaining its dedicated login and forced-password routes.
- Staff may administer every employee/calendar, CRM/GDPR action, account-security action,
  payment/refund, website publication/media setting, resource, order, appointment, and chat.
  This supersedes earlier staff-own-only and admin-only business/configuration requirements.

## Admin-managed public imagery (owner-approved 2026-08-01)

Every visitor-facing content image must be replaceable from its owning admin editor: homepage
poster/area imagery, booking imagery, content-page heroes and Markdown images, service-category
heroes, treatment/course images, technology heroes, product images, article covers, Endospheres
editorial images, and default or page-specific social previews. The selected image is shared across
FI/EN/RU while meaningful alt text is required per published locale; decorative imagery is marked
explicitly and renders an empty alt. Each cropped slot stores a 0–100 horizontal and vertical focal
point, defaults to 50/50, and uses it consistently at mobile and desktop sizes.

Use the existing authenticated Cloudinary upload path, MIME/size validation, audit trail, and
route revalidation. Required images cannot be removed from published entities; optional editorial
images may be removed. Replacing a reference does not delete the former Cloudinary asset. Sitemaps,
JSON-LD, Open Graph metadata, booking, basket, and other derived surfaces must use the same managed
record as the visible page.

Backfill existing visuals without changing appearance. Treatment options persist the image resolved
by the former procedure-media precedence. When localized legacy page images differ, choose FI, then
EN, then RU, while keeping localized alt text. Migration and content sync are guarded, idempotent,
and never overwrite unrelated admin edits. Brand logos, favicon, icons, decorative vectors/CSS,
email branding, and the homepage video remain code-owned; its poster is managed.

## Service treatment detail pages and stable options (owner-approved 2026-08-01)

All `/palvelut/*` category pages use one service-specific mobile-first card template. Render exactly
one hero image and one `h1`, followed by a short approved overview, responsive treatment/course
cards, and then the remaining approved benefits, expected results, safety/contraindications,
preparation/aftercare, and FAQ. Each card shows its localized group and complete name, a complete
same-locale source paragraph or semantic list block as its extractive summary, duration, published
price, localized “View details” action, and an independent
localized “Book now” action. A stretched detail link makes the remaining card area open
`/palvelut/<service-slug>/<option-key>` without covering the booking button. Use one column at 390 px and two or three
columns where space permits; keep a sole option full width. Treatment-specific images are admin-managed
and may be rendered without obscuring the actions. Do not add a hero booking action.
`/laitehoidot/*` and `/trikologia` retain their existing information-first
selector presentation.

The hero contains only `shortDesc`, which is exactly the first complete semantic source block; benefits,
advantages, results, course, safety, and other structural headings remain below the hero. Below it, render the richer same-locale `whatItIs` overview
under a localized heading in a responsive editorial split; do not repeat the hero summary. Every
category overview is two or three concise, source-grounded paragraphs and remains admin-editable.
Never store an aggregate procedure list in `whatItIs`. Treatment detail pages must not render the
same summary again at the start of the full description. Remove the complete matching Markdown prefix,
including multi-block/list summaries, before rendering the remaining detail body. Names and treatment copy must not use
generated terminal ellipses, token/word truncation, or visual line clamps. The complete selected
summary block must remain visible at 390 px and desktop widths.

The structured information order is: what it is/how it works; suitable for; benefits; expected
results and recommended sessions; safety and contraindications; preparation; aftercare; FAQ where
useful source material exists. All seven core sections are non-empty for every published option.
The directly published copy is owner-editable. Facts follow this authority order: clinic
PDFs/documents; existing same-locale Mone Beauty copy; official manufacturer documentation; then
authoritative medical or public-health sources. A committed localized enrichment registry and
provenance manifest map every option to identifiable sources. Model-authored organization and
translation may express sourced facts but must not introduce unsupported medicines, dosages,
credentials, guarantees, medical claims, or prices. Do not use cross-locale runtime fallback.
Packages and unspecified injectable choices explain that procedure-specific suitability, safety,
and contraindications are established during an individual assessment rather than inventing one
universal list.
The July 2026 PDFs supersede scraped English Endospheres content on both canonical Endospheres
routes; unapproved FI/RU translations are not introduced.

Persist normalized `ServiceOption` and localized `ServiceOptionContent` records with a stable key,
parent service, order, optional localized group, localized treatment name, published duration and
price labels, an admin-editable complete-block extractive summary, the admin-editable complete source Markdown,
source URL and scrape date, server-owned booking minutes, appointment/course/legacy informational-package type,
and bookable, publication, and archive state. Preserve locale-specific catalogs, labels, prices,
descriptions, and ordering without fallback. Summary text must be the first complete coherent source
paragraph or semantic list block in that locale; generic editorial boilerplate is forbidden.
Duration ranges reserve their maximum published time. Services without a procedure list receive
one parent-level option using the configured duration; omit a price when none is approved.

Every published active `APPOINTMENT` or `COURSE` option is bookable and has a valid server-owned
duration. `INFORMATIONAL_PACKAGE` remains only for archived or legacy non-bookable records. Every
course booking reserves its first visit only and tells the customer that remaining sessions
are arranged with the clinic. Endospheres and other duration-labelled courses reserve their
published 30/45/60/75-minute visit. AROSHA and laser courses reserve 60 minutes, fractional
mesotherapy reserves 60 minutes, and Reset reserves the Packages service's existing 90 minutes.
Course detail pages show the complete published package price and explain that the reservation is
for the first visit while later sessions are arranged with the clinic. The price is snapshotted on
the first appointment; payment remains at the clinic. The detail page booking action uses
`/ajanvaraus?service=<slug>&option=<stable-key>` and opens at Date & Time. Legacy
`procedure=<one-based-index>` links resolve to the migrated stable option where possible.

Packages options are maintained in a source-attributed canonical registry. Use semantic stable
keys, merge FI/EN/RU records only when their source entries are the same course, and retain
locale-only courses without cross-locale content fallback. A guarded dry-run/apply migration
creates canonical records and archives only superseded generated records that still match known
source-owned values; it is idempotent and must not overwrite unrelated admin edits. A canonical
option stores a server-owned scheduling-service target: Endospheres and laser courses must reserve
their device-capable service resources, while AROSHA, fractional mesotherapy, and other courses use
the corresponding qualified service capability. The public page/service identity remains Packages.

New appointments relate to the selected option and snapshot its localized title, price, and
booking duration. Retain legacy `procedureIndex`, `procedureTitle`, and `procedurePrice` fields so
historical rendering remains unchanged. Availability, end-time, overlap checks, resource
allocation, rescheduling, calendar/staff/admin editing, and notifications resolve options on the
server and never accept a client-supplied duration or price. Legacy informational packages, unpublished,
archived, non-bookable, or mismatched service options must be rejected.

Group category options by their localized treatment group. Cards use equal grid rows, a consistent
title region, clamped summaries, and bottom-aligned metadata/actions. Duration and price share one
non-wrapping row; when the price label exactly repeats the separately rendered duration suffix,
suppress only that duplicate suffix on the category card. Hover must not change border color; use
a subtle warm shadow/translation or background shift, preserve visible keyboard focus, and honor
reduced motion.

After the Endospheres option grid, replace the legacy Markdown stream with localized structured
sections. Use alternating heading/content columns, a benefit grid, and at most three relevant real
images in bounded 4:3 frames capped at 420 px high on desktop. Do not render the nine sequential
legacy full-width images. English is sourced from the approved PDFs and FI/RU from each locale's
scraped page.

Each `/palvelut/<service-slug>/<option-key>` route resolves only a published, non-archived option
belonging to that service with published content in the requested locale. It renders breadcrumbs,
one relevant real image, one `h1`, group, complete source Markdown, duration, price, and approved
practical content. Bookable appointments and courses show “Book now”; legacy informational options show a clinic-contact
action. Invalid, mismatched, archived, unpublished, and missing-locale options return 404. Locale
switching to a locale without option content goes to that locale's parent category instead of
showing fallback content.

The generic public wizard remains Service → Time → You. The detail-page action completes Service;
a valid service-plus-option deep link opens at Time. Changing service clears the option. Locale
switching, localized URLs, pay-at-clinic behavior, option metadata/canonical/hreflang/Service
JSON-LD and sitemap entries, Endospheres introductory
offer eligibility/account rules, both Endospheres routes, and informational package pricing remain
compatible. PostgreSQL/admin content is authoritative; source-attributed committed migrations are
guarded, support dry-run/apply, and do not overwrite unrelated admin edits. Admin service editing
manages every structured treatment field, active option, and treatment image; legacy procedure-media
history remains stored for rollback but is no longer the primary editing interface.

Ordinary migration matches use localized name, group, price, and legacy index; Packages use the
canonical semantic-key registry. Populate only empty or known source-owned summary, description,
and provenance values. Preserve stable booking identity, duration, price, scheduling-resource
targets, unrelated admin edits, locale-only entries, and archived records. Aggregated procedure
descriptions must not be stored in category-level `TreatmentContent.whatItIs`; that field retains
genuine category overview content only.

## Cancellation policy (client-approved 2026-07-31)

Appointments must be cancelled or rescheduled at least 24 hours before the booked time.
Cancellation or rescheduling less than 24 hours in advance but before the appointment date
incurs 50% of the service price. Same-day cancellation or rescheduling and no-shows incur 100%.
Publish the same policy in FI/EN/RU in the booking flow, appointment emails, secure appointment
management, client account, clinic rules, and localized Terms page. Appointment changes remain
available online inside the fee window. The clinic administers fees manually; appointment
payments remain outside Stripe and never create automatic website charges or invoices.

## Body Treatments Endospheres mirror (owner-approved 2026-08-13)

Keep both the dedicated Endospheres and Body Treatments routes. Resolve the Body Treatments landing
route through the exact same requested-locale published Endospheres service record as the dedicated
route. Render the complete Endospheres experience: hero, H1, summary, overview, structured editorial,
managed hero/editorial/before-and-after imagery with localized alt text and focal positions, booking
CTA, treatment/course cards, and option-detail links. Both landings must use the Endospheres service
identity, database content, and managed-media slots so admin edits remain synchronized.

The Body Treatments landing must not render its stored hero, copy, treatment/course cards, treatment
information, or laser body zones. It must use Endospheres metadata, social image, structured data,
canonical URL, and hreflang URLs, and it must be excluded from the sitemap as duplicate canonical
content. Keep its navigation and service-index label/link and preserve its database records and option
detail routes. Do not use another locale or Body Treatments as fallback: when the requested locale's
Endospheres service or published content is absent, return 404. Leave the dedicated Endospheres route
unchanged. No schema, migration, public API, admin editor, or public route change is required. This
requirement supersedes the previous appended-content behavior.

## Endospheres content, pricing, booking, and offers (client-approved 2026-07-30)

The two repository-root July 2026 Endospheres PDFs are the newest authority for English
Endospheres treatment copy and pricing. Publish that approved English experience on both
canonical Endospheres routes through one responsive component. Keep existing Finnish and
Russian public content unchanged; translations of the new medical copy remain committed
review-only drafts and must not be exposed through locale fallback.

Expose fixed-price 30/45/60/75-minute booking variants at €65/€85/€105/€125 and an
introductory 75-minute variant at €99. Retain the generic Endospheres service as the public
content entity but hide it from the picker. Every variant shares the `endospheres` booking
family and the parent's practitioner, room, and physical-device capabilities. Publish the
same single and 6/12-treatment package prices in the global price list. Packages are
informational, payable at the clinic, and never Stripe products.

Every promotional offer requires an authenticated client account. Inside the serializable
booking transaction, the introductory offer matches clients by normalized email or phone
and rejects a client with any non-cancelled Endospheres-family appointment. Cancelled
appointments do not consume eligibility. Return localized account/eligibility errors and
retain the selected start time when changing to the regular 75-minute treatment. Disabling
the offer service hides it without deleting appointment history.

## Employee self-configuration and unified Admin -> Staff (owner-directed, 2026-07-22)

`/henkilosto` exposes a versioned settings area for the authenticated staff user's own name,
normalized unique login email, password, professional title, calendar color, split-shift weekly
schedule, date exceptions, qualified services, and service-specific room/device permissions.
Supplied employee identifiers are rejected. Email changes require the current password, revoke
all sessions, and require a new login. Staff cannot change account status, practitioner active
state, display/allocation order, other employees, global services, or room/device inventory.

Admin -> Staff is the sole complete employee editor and groups Account, Profile, Schedule, and
Booking Capabilities. It retains password reset, session revocation, activation, audit, and
credential deletion. Calendar Setup manages only clinic-wide service resource pools, rooms,
devices, and block templates and links to employee capability editing.

`PractitionerServiceCapability` is the only qualification source. Each record binds one employee,
one service, and one permitted room and lists the permitted physical devices. Qualification exists
only while at least one complete capability exists. Capability resources must be active and belong
to the service's admin-approved pool. Public and internal scheduling enumerate these exact
combinations and never construct Cartesian combinations outside them.

Every configuration response and mutation carries an optimistic version. A stale mutation returns
409 without changing data. Removing a qualification, capability, room/device permission, weekly
interval, or date exception that an active future appointment depends on returns 409 with the
affected appointment count and identifiers. Successful and denied mutations are audited with
actor, target employee, section, and affected resource identifiers.

## Complete resource-safe scheduling (owner-directed, 2026-07-22)

Public availability is the union of complete, conflict-free allocations across ordered qualified
employees, allowed rooms, and required physical devices. Public APIs never accept or expose the
chosen internal resources. Booking, internal creation/movement, and approved rescheduling must
recalculate candidates inside transaction-scoped locks and try every valid alternative before
returning a clash.

`Practitioner.workingHours` stores a versioned `Europe/Helsinki` weekly schedule with independent
15-minute intervals per weekday and split-shift support. Explicit per-date `Availability` is the
complete override. Admins manage every employee and clinic scheduling resource; staff may mutate
only their linked employee's hours, exceptions, internal blocks, and preferences. Configuration
changes that invalidate active future appointments are rejected. Version one persists one
employee, one service/procedure, one room, and zero/one device per appointment; allocation and
conflict interfaces remain extensible pending the clinic's multi-employee/sequential-treatment
answer.

## Owner-approved Stripe website payments (2026-07-19)

Website-originated purchases use Stripe-hosted Checkout with signature-verified,
idempotent webhooks as the authority for payment and refund state. Published physical
products, fixed-value balance gift cards, and explicitly configured single-use treatment
vouchers may be purchased online. Physical orders offer free clinic pickup or one
Dashboard-managed Finland shipping rate; digital-only orders require neither. Paid-order,
fulfilment, voucher, refund, and localized customer/staff notifications are durable and
audited. Stripe events that are not tied to a known Mone Beauty website order are ignored.
Stripe's Checkout return link securely expires the open Session, and the resulting signed
expiry webhook is authoritative for customer cancellation. Admin order lists/details label
open unpaid website orders Awaiting payment and support filtering by that derived state.

Appointment booking remains Service -> Time -> You and never takes online payment. Clients
pay for in-person appointments at the clinic by credit card, and no Stripe invoice or
post-appointment charge is created. Listed EUR prices are charged as gross totals; Stripe
Tax remains disabled until accountant-approved registrations and per-item tax rules exist.

## Owner-approved accounts, staff RBAC, and audit trail (2026-07-19)

Clients may self-register at `/oma-tili` using email verification. Accounts are optional for
booking. Authenticated bookings attach directly to the account. After initial email verification
and after every successful client login, an idempotent transaction attaches guest orders and
appointments whose normalized snapshot email or Finnish/international phone matches the account.
The verified account email is the authentication proof; no phone OTP is required. A phone match
must not claim a guest record whose snapshot email belongs to another verified client account,
and a record already owned by another registered account is never transferred. Snapshot contact
fields remain immutable, related appointment change-request ownership moves with the appointment,
and each successful link is audited without contact values. Legacy guest appointments may also be
claimed through their hashed single-use link; claims are idempotent and cannot override another
account's ownership. The account shows only that client's past/upcoming procedures and submits cancellation/reschedule
requests; requests never change an appointment until an admin approves them after repeating
all employee, room, device, availability, and overlap checks.

The account Orders view includes every linked order, including terminal and unsuccessful orders.
For orders that are not shipped, fulfilled, or cancelled, a client may submit a 3–500 character
cancellation reason, with at most one pending request per order enforced by PostgreSQL. Clients
see pending, approved, and rejected request states. Admin Orders exposes request filters and
approve/reject controls; staff receive no order permission. Approval revalidates ownership and
state, then expires an open unpaid Stripe Checkout session, cancels an unpaid legacy order, or
creates an idempotent refund for the complete remaining refundable balance of a paid or partially
refunded Stripe order. The existing signed webhook authoritatively finalizes Stripe refunds and
order cancellation. Rejection requires an admin reason. Provider failures leave the request
retryable and the order unchanged, with redacted audit/integration failure records. Localized
acknowledgement and decision notifications are sent; existing cancellation/refund notifications
remain authoritative when order state changes.

Admin, staff, and client login surfaces are separate. Creating a staff account automatically
creates and links its one-to-one employee calendar profile; no employee selector is exposed in
the account form. Admin-created and reset temporary passwords must be non-empty and at most
128 characters, while the required first-login replacement retains the normal 12-character
minimum. Back-office users can view every staff account, reset passwords, revoke sessions, revoke or
restore access, inspect audit history, and permanently delete credentials after confirming the
staff email. Credential deletion retains the employee calendar profile, appointments, and
audit records. Staff receive no account confirmation email and must replace the temporary
password at first login. Staff receive full back-office access after replacement; the raw Audit
Logs, global Integration Logs, and audit export remain administrator-only.

The admin exposes staff management and immutable audit views. Audit security/authentication,
password/session events, sensitive staff appointment-detail access, denied mutations, and
admin staff-account actions with actor, outcome, target, time, IP/user-agent, and safe
metadata. Audit data has filtering/export but no application deletion or automatic purge.

## Owner-approved shared calendar and employee assignment (2026-07-19)

The admin sidebar exposes `/admin/kalenteri` in every interface locale. The calendar follows
the supplied Timma Pro reference: day/week/month navigation, all active employees visible in
separate columns, availability at a glance, and appointment cards showing client, procedure,
room, and time. Admins may create appointments, update active appointment details, change
rooms/devices, and move appointments in time or between qualified employees. Staff may perform
those operations only for appointments assigned to their linked employee. A Create
appointment button is always available, and selecting an empty available time in day/week view
prefills its employee, date, and time. Staff may edit only their own availability and cannot
change calendar setup or other clinic configuration.

Staff-created appointments search or create a CRM client, require recorded GDPR acknowledgement,
start as confirmed, and send the localized durable email/SMS confirmation. Creation, detail
changes, lifecycle actions, schedule moves, sensitive access, and denied mutations are audited.
Existing-client selection uses an accessible dropdown with 300 ms debounced lookup by name,
phone, or email; no separate search action is required. It initially lists the 20 most recently
updated non-archived clients and supports clearing with Backspace/Delete. Name, phone, and email
are always visible, are populated from a selected client, and remain editable. Appointment saves
persist those values as an immutable-to-CRM booking contact snapshot used by calendar/detail views,
email, SMS, reminders, and claim delivery; edits do not update the linked CRM client record.

### Timma-style internal calendar reservations (owner-approved, 2026-07-21)

The calendar must provide dense day, full Monday-first seven-day week, and month views inside the existing
localized admin shell. Its toolbar includes All/Working and generated employee filters, view and
date navigation, a themed date picker, Create appointment, zoom, refresh, and setup. Day/week
hours use the selected employees' open-time union plus a separate out-of-hours exception row,
48 px/hour by default, sticky headers and bilateral time labels. Past weekdays remain visible.
Every employee/day column renders visible one-hour rows even without appointments or configured
availability; an otherwise empty grid falls back to 10:00–19:00. Invisible 15-minute hit targets
retain exact placement but become visible only on hover or as the active drop target. Zoom persists locally at compact,
default, or expanded density. Week headings use initials at high density and full names for a
narrow selection. At desktop widths, all selected day/week employee columns share the available
grid width without horizontal scrolling. The collapsed 76 px sidebar rail reserves space, while
the expanded sidebar overlays the calendar without changing its width or position. Month uses a
seven-column grid, compact event rows, and `+N more`. Below desktop widths, the internal-service
palette changes to a horizontal tray and the grid scrolls horizontally while preserving sticky
axes. Pointer, touch, and keyboard users must retain equivalent actions. Day/week grids have no
nested vertical scrollbar; their full height participates in page scrolling.
Every month date is navigable, including empty future dates. Empty day/week quarter-hour targets
support vertical selection locked to the starting date/employee column. Selected cells render as
one continuous shaded range without internal borders and immediately open Create appointment on
release, using the complete selected duration. Internal blocks and availability remain available
through their dedicated drag/drop and toolbar controls. The toolbar uses magnifying-glass zoom
icons with localized hover/focus tooltips and replaces quarter-slot Open / closed times with
tooltiped Add workday and Remove workday actions.

`CalendarBlockTemplate` is distinct from clinical `Service` and stores EN/FI/RU labels, default
duration, Mone-compatible color, active state, and display order. Generate the complete Finnish
catalog and Finnish drag aliases unchanged from `internal-services.txt`, with complete committed
English and Russian translations and independently editable per-locale drag aliases of at most 14
characters. The dialog copy, service rows, shortcut rail, drag preview, controls, tooltips, and
accessible names follow the active locale. Retain the first four internal entries as the default
shortcuts, leave all remaining entries unselected, and allow at most 24 locally selected
shortcuts. Admins alone manage
templates. Active templates may be dragged or selected then placed at a 15-minute position inside
an hourly row. Dragging shows a floating preview and highlights the hovered future vacant target. The Booking info
modal contains date/start/end, a primary item, ordered additional items, target employee, at most
one optional room or device, notes, and recurrence/add-to-others. Items are sequential; their
durations determine the end, and an edited end changes the final item duration.

Recurrence accepts selected weekdays and an inclusive end date no more than 12 months ahead.
Admins may target multiple active employees; staff may target only their linked employee. The UI
previews the occurrence count. A request may generate at most 500 concrete occurrences and saves
atomically: any active appointment/block conflict for an employee, room, or device rejects the
whole request and identifies the conflicting date/resource. Editing and soft cancellation support
the current occurrence or all future occurrences in a series, use optimistic `version` checks,
and are audited without customer notifications.

`CalendarBlockSeries`, `CalendarBlock`, `CalendarBlockItem`, and `CalendarBlockParticipant`
persist recurrence metadata, concrete time/resource reservations, ordered duration/label
snapshots, participants, status, and version. `GET /api/calendar` returns localized active
templates and expanded occurrences. Authenticated create/update/cancel endpoints enforce RBAC.
Every appointment create/reschedule/move and block mutation uses shared conflict checks covering
active appointments and blocks plus transaction-scoped PostgreSQL advisory locks for affected
employee/resource/day keys; existing appointment exclusion constraints remain. Public
availability omits internally reserved time. Blocks never change working hours or availability.

Working-time visibility (owner-approved, 2026-07-19): normalized
`Practitioner.workingHours` is the canonical weekly schedule and explicit per-date
`Availability.slots` override it. Day/week calendars crop to the visible employees' earliest-to-
latest open-time union; closed gaps are not selectable. Date pickers keep unavailable dates in
place but disable them, and scheduling time pickers contain only valid open starts. The authorized
working-hours editor alone may select the full day so hours can be expanded. Existing appointments
outside current availability remain visible in a separate out-of-hours exception row. Add workday
replaces one employee/date override with an exact 15-minute-aligned open range; Remove workday
persists an empty override without changing recurring weekly hours. Admins may select any active
employee while staff remain restricted to their linked employee. Past dates and changes that
would place active appointments outside the resulting workday are rejected and audited.

The verified client account is a localized dashboard with overview, appointments, orders, saved
addresses, and profile sections. Verified email is visible and read-only; name and phone are
editable. Exact-email guest orders are linked after verification only when they are not owned by a
different verified account. Authenticated booking and checkout reuse the exact linked Client rather
than matching identity from submitted email. Finland shipping checkout can select or create a saved
address; Stripe's final address updates only the order snapshot.

Appointment confirmations include service/procedure, employee, localized Helsinki date/time and
duration, pay-at-clinic details, clinic contact/location and map links, Google/Apple/Outlook calendar
actions, the published 24-hour cancellation policy, and a secure account-based cancel/reschedule
action. Cancellation remains an admin-reviewed request until approved.

Every server-side email, SMS, Stripe, Anthropic, and Cloudinary request records an admin-visible,
redacted integration attempt with provider operation, outcome, HTTP status, provider/request ID,
latency, safe response metadata, retry number, and related entity. Logs expire after 30 days and
must exclude secrets, authorization data, raw payment data, and unnecessary personal content.

Public booking remains **Service -> Time -> You**. Every bookable service has an ordered set of
qualified employees and no customer-facing employee picker. Public availability combines their
resource-safe slots; creation assigns the first conflict-free employee in calendar display order
inside the locked transaction. Rooms and physical devices are separate resources and every active appointment
must be rejected if it overlaps its employee, room, or required device. This section
supersedes both the fixed-primary and 2026-07-17 single-clinic-resource decisions below.

## Superseded public booking assignment (2026-07-17)

The public booking wizard is **Service -> Time -> You**. Contextual booking links and valid
homepage handoffs open directly at Time. Customers do not choose or see an individual
provider; the server assigns every new public booking to the exact **Mone Beauty Clinic**
clinic scheduling resource and ignores client-supplied practitioner IDs. Practitioner
choices and provider identity are not exposed in customer or operational interfaces;
historical relations remain stored for integrity.

## Owner-approved themed controls (2026-07-18)

Every form dropdown must use the application-themed custom listbox. Date and time selection
must use the booking-style month grid and time chips; compact forms use popovers while the
booking wizard keeps its calendar inline. Controls must be keyboard accessible, localized,
mobile-safe, and use the existing design tokens.

## Owner-approved admin operations (2026-07-18)

The admin sidebar exposes `/admin/ajanvaraukset` and `/admin/tilaukset` in every interface
locale. Orders follow Pending -> Confirmed -> Fulfilled or Cancelled. Appointments follow
Booked -> Confirmed -> Completed or Cancelled; a customer reschedule returns a confirmed
appointment to Booked for clinic reconfirmation. Confirmation, rescheduling, and cancellation
use localized transactional email/SMS with durable provider-attempt history and safe retry.

## Owner-approved homepage direction (2026-07-12)

Reproduce root `index.html` as the homepage visual and content reference. Its medical,
diagnostic, evidence-based, and licensing language is owner-approved for this page: centered real-video hero and
three facts, Standard of Care, clinical services with explicit missing-medical-content stubs,
alternating technologies, accessible AROSHA/DIXIDOX tabs, compact one-click booking handoff,
and clinic standard/contact. Preserve localization, generated content/media, cart, booking,
chatbot, SEO, and the global shell. This supersedes older homepage section-order language.

## Owner-approved Finnish public routes (2026-07-17)

All user-facing routes use Finnish path segments in every locale. FI has no prefix; EN and RU
use `/en` and `/ru`. Canonical bases are `/klinikka`, `/laitehoidot`, `/palvelut`,
`/verkkokauppa`, `/ostoskori`, `/kassa`, `/tilaus`, `/ajanvaraus`, `/hinnasto`,
`/artikkelit`, `/tietosuojaseloste`, `/kayttoehdot`, `/evastekaytanto`, and `/henkilosto`.
Legacy English public paths permanently redirect. API/admin paths and dynamic product/article
slugs remain unchanged.

> **This document is binding.** It is the distilled, authoritative requirements spec for
> the project. Together with [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) it is the
> contract the build must follow. Do not deviate without updating these documents first.
> See the guardrails in [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md).

## 0. Source-of-truth hierarchy

The app realizes the **client brief** (`SCOPE.md` = **Mone Beauty Clinic**), an
aesthetic-medicine clinic. On conflict, resolve:

| Source                                                                       | Authoritative for                                                                                 | Strictness        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------- |
| [`SCOPE.md`](./SCOPE.md)                                                     | **Brand, positioning, IA/structure, product features** (booking, CRM, admin, chatbot, shop, GDPR) | Binding: wins    |
| [`design_handoff_mone_beauty_clinic/`](./design_handoff_mone_beauty_clinic/) | **Visual design system** (tokens, type, spacing, radii, shadows, components) + page structure     | Strictly followed |
| [`scraped_content/`](./scraped_content/)                                     | **Existing-page copy, images, video, real NAP/media** (3 locales)                                 | Reused as content |

Where `SCOPE.md` conflicts with `scraped_content/` (brand name, positioning, homepage
structure), **`SCOPE.md` wins**. The user's explicit technical direction (Prisma + Postgres)
**overrides** any conflicting handoff recommendation (e.g. the handoff's Payload CMS).

### Content-sourcing rule (binding)

- **Brand, positioning, and IA/structure come from `SCOPE.md`.** Existing-page **copy,
  images, and video come from `scraped_content/`**: reuse real media; **no gradient
  placeholders where real media exists.**
- **No invented medical claims.** Never fabricate procedure/medical text. The two SCOPE
  category pages absent from `scraped_content` retain hand-authored appointment framing in
  `content/authored-pages.ts`. Their normalized treatment options may publish the sourced,
  conservative assessment/safety sections defined above, but no unsupported named procedure,
  medicine, dosage, indication, outcome, price, or credential/regulatory claim may be added.
- Content is baked into committed registries by `scripts/gen-content.mjs`
  (`content/generated/*.json`); media by `scripts/copy-media.mjs` (`public/media/**`).
  `scraped_content/` stays git-ignored: re-run both scripts to refresh.

### Locked decisions

- **Brand: Mone Beauty Clinic**: real `public/logo.svg` + `app/favicon.ico`.
- **E-commerce is IN scope**: AROSHA/DIXIDOX catalog (`/verkkokauppa`,
  `/verkkokauppa/[slug]`, `/ostoskori`);
  Prisma-backed hosted Stripe Checkout captures website purchases and webhooks reconcile
  payment/refund state without affecting clinic-paid appointments.
- **Custom admin on Prisma: no Payload CMS.**
- **Stack is locked** (§2).

---

## 1. Overview & brand

- **Name:** **Mone Beauty Clinic** (per `SCOPE.md`; renamed from the old "Club"). Kept in a
  single config constant (`content/site.ts`); the header/footer render the real `logo.svg`.
- **Positioning:** an aesthetic-medicine clinic in Helsinki: "Next-Generation Aesthetic
  Medicine; a comprehensive approach to beauty, skin health, and the natural harmony of face,
  body, and hair." Real services (endospheres, laser, RF lifting, trichology, facial & body
  care) plus AROSHA products; SCOPE's additional medical category pages retain authored
  appointment framing and their bookable options publish source-backed assessment and safety copy.
- **Visual language:** luxury minimalism / Scandinavian medical-beauty. Milky-white, cream,
  beige, sand, taupe, soft-brown surfaces with subtle-gold accents; editorial serif
  (Cormorant Garamond) + clean grotesque sans (Jost).
- **Avoid:** neon colors, salon-pink, clinical white-and-blue, heavy-black backgrounds,
  cheap stock photography, overloaded layouts.
- **Real contact details** (from `scraped_content/`, override handoff placeholders):
  - Address: **Solvikinkatu 5, 00990 Helsinki, Finland**
  - Phone: **+358 40 129 3800** · Email: **info@monebeauty.fi**
  - Socials: Instagram, Facebook, WhatsApp · Hours: by appointment.

## 2. Tech stack & global constraints (LOCKED)

- **Framework:** Next.js (App Router) + **TypeScript**: SSR/SSG for SEO-critical pages.
- **Styling:** **Tailwind CSS**, theme generated from `01-design-system.md` tokens (CSS
  variables for switchable `accent` + `--radius`).
- **Fonts:** `next/font`: Cormorant Garamond (400/500/600 + italic), Jost (300/400/500/600).
- **Icons:** `@phosphor-icons/react`, **thin** weight throughout.
- **ORM/DB:** **Prisma + PostgreSQL** (EU-hosted for GDPR).
- **Auth:** role-based: `admin`, `staff`, `client` (Auth.js/NextAuth or custom on Prisma).
- **i18n:** `next-intl`, locales **ru / fi / en**, locale-prefixed routes + `hreflang`.
- **AI:** **Anthropic Claude API** (latest model) for the chatbot.
- **Email/SMS:** transactional email (Resend/Postmark) + SMS (Twilio or FI gateway).
- **Analytics:** GA4 + Google Search Console; `next-sitemap`.
- **Non-functional:** SSL everywhere; **mobile-first** (verify at 390px first); accessible
  (WCAG AA, `prefers-reduced-motion`); fast (image optimization, lazy-load, lean JS on
  marketing pages); EU data residency.

## 3. Internationalization (RU / FI / EN)

- Language switcher in the header (`EN ▾` style dropdown).
- All public pages localized with locale-prefixed routes and `hreflang` alternates.
- Locale detection + persisted choice.
- Content authored **per-locale** in the admin: **do not auto-translate** medical or legal
  copy; each language is clinic-approved. `scraped_content/{fi,en,ru}/` provides starting copy.

## 4. Site map / pages (Finnish segments, locale-prefixed en/fi/ru)

**Content pages** (real copy from `scraped_content`, rendered via `react-markdown`):

- `/` Home: real hero video + serif brand heading, 3 featured services, AROSHA product grid
- `/klinikka` About Us (incl. real Club Rules / cancellation / return copy)
- `/laitehoidot/{endospheres,laserkarvanpoisto,mikroneula-rf}`
- `/trikologia`, `/arosha`
- `/palvelut` (index) + `/palvelut/{kasvohoidot,vartalohoidot,endospheres-terapia,
laserkarvanpoisto,mikroneula-rf,trikologia,kulmat-ja-ripset,hoitopaketit,lahjakortit,
injektiohoidot,konsultaatio}`

**Shop:** `/verkkokauppa` (31 AROSHA/DIXIDOX products, grouped by category),
`/verkkokauppa/[slug]` (product detail: image, price, size, real description, related),
`/ostoskori` (real cart), `/kassa`, `/tilaus/[id]` confirmation.

**App / authenticated:** `/ajanvaraus` (booking), `/henkilosto` (staff), `/admin`.

**Legal (footer):** `/tietosuojaseloste`, `/kayttoehdot`, `/evastekaytanto`.

**Global elements:** sticky blurred header (real logo, dropdown nav for Instrumental &
Services, cart, language switcher, Book time); footer (nav + contacts + opening hours "By
agreement" + socials); chat FAB; SEO `<head>` (title, meta, OG, hreflang, JSON-LD).

## 5. Design system requirements

Admin and operational interfaces use an isolated Inter type system with Latin, extended Latin,
Cyrillic, and extended Cyrillic coverage. Page titles are 34–42 px semibold, section and modal
titles 22–28 px semibold, navigation/body copy 14–15 px regular or medium, and labels/actions
12–13 px medium or semibold with restrained tracking. Operational metadata may use 11–12 px and
dates, times, prices, and counts use tabular numerals. Public Cormorant/Jost typography is not
changed.

Admin-facing icons remain tree-shaken Phosphor vectors but use regular weight by default and bold
only for active/selected states. Navigation icons are 20–22 px, toolbar/actions 18–20 px, field
adornments 16–18 px, and status/empty-state icons 24–28 px. Icon-only controls provide a localized
accessible name, visible keyboard focus, a minimum 44 px target, and a hover/focus tooltip when
their purpose is otherwise hidden. Text glyphs must not substitute for available control icons.

Reproduce `01-design-system.md` **exactly**, expressed as design tokens: never hand-repeat
hex values across components.

- **Colors:** page `#FBF8F3`, alt `#F5EFE4`, card `#FCFAF6`, dark CTA `#2A2520`, footer
  `#221E1B`; accent `#97785A` (+ alt theme options); text primary `#3A322B` (never pure
  black), body `#6B6056`, muted `#8A7E70`; the full border/footer/dark palettes in the spec.
- **Type:** fluid `clamp()` scales with the **exact** min/max endpoints from the spec.
- **Spacing/layout:** max width 1280px (Technologies 1100px); section padding clamps;
  responsive breakpoint **900px** (desktop nav → hamburger + slide-down).
- **Radii:** `--radius` 16px (Soft) default / 4px (Minimal) option; buttons 4px.
- **Shadows:** warm brown-tinted only (`rgba(58,42,28,…)`): never neutral grey/black.
- **Motion:** documented transitions/hover lifts; honor `prefers-reduced-motion`.
- **Components (reuse, do not re-style ad hoc):** Button (primary/outline/primaryOnDark/
  textLink), Eyebrow, SectionHeading, Card (treatment), FeatureItem, ImageSlot
  (`next/image`), Header/Navbar, MobileMenu, Footer, CTABand, ChatWidget FAB,
  LanguageSwitcher. Build a `/styleguide` page demonstrating all of them.

## 6. Service & content pages (SEO)

Service/content pages mirror the live site and render **real per-locale copy** from
`scraped_content` via a shared `ContentPage` + `react-markdown` (title + markdown body,
images resolved from `public/media/**`). No invented content.

**Instrumental cosmetology:** `/instrumental/endosphere`, `/instrumental/laser`,
`/instrumental/mikroneulanrf`.
**Services:** `/services` index + `/services/{face, body, tricho, laser, mikroneulanrf,
eyebrows, packages, gift-cards}`.
**Standalone:** `/trichology`, `/arosha`.

Each: `content/generated/pages.json` (from `scripts/gen-content.mjs`) keyed by slug × locale.
**SEO per page:** `title` + `metaDescription` (excerpt) + `hreflang`. Product pages also emit
`MedicalProcedure`/`Service` JSON-LD; the homepage emits `MedicalClinic` JSON-LD (Helsinki NAP).

## 7. E-commerce: AROSHA shop

- **Catalog** of the **31 products** captured in `scraped_content/*/catalog/` with real
  images from `scraped_content/assets/`.
- **Categories:** AROSHA body line and DIXIDOX / De Luxe trichology line.
- **Product detail:** images, name, size (ml / pack), price (band ≈ €39–€85), description,
  related products, add-to-cart.
- **Cart + checkout:** GDPR-compliant checkout (consent capture), Stripe-hosted payment,
  webhook-authoritative order/refund state, pickup or Finland shipping for physical goods,
  automatic gift/treatment vouchers, localized notifications, and order confirmation in
  the public order page and `/admin`.
- Built with the **same design system**; mobile-first.

## 8. Online booking

An explicitly linked published service may resolve in booking even when `bookingPickerVisible` is
false; this does not add it to the general picker. In particular,
`/<locale>/ajanvaraus?service=endospheres` presents all published Endospheres duration options and
does not silently choose one. The Endospheres landing CTA has service-specific localized heading and
action copy (English: “Ready to book Endospheres Therapy®?” and “Book an appointment.”) and preserves
the active locale. When a valid selected service has a managed image, the booking page uses that image,
its focal position, and its localized alt text. The global booking hero is only the fallback for a
missing/invalid selection or a selected service without an image. Hidden-service resolution remains
limited to explicit contextual links and does not change the picker, schema, scheduling, or booking API.

All active public **Book** and **Book Online** CTAs open the localized dedicated `/ajanvaraus`
flow. Generic CTAs open service selection; service and technology CTAs use
`/ajanvaraus?service=<service-slug>`; procedure cards additionally use a validated, one-based
`procedure` index. The ordinary Consultation navigation link may remain an in-page anchor.
Locale switching preserves valid booking context.

The compact homepage booking form remains as a safe handoff. It transfers name, phone,
email, notes, preferred date, and service through a versioned tab-scoped `sessionStorage`
record with a 30-minute expiry. Personal data must never be placed in the URL; the booking
wizard consumes and removes the record once. Contextual URLs advance directly to Time, while
changing service clears procedure context, reloads availability for a retained valid date,
and updates the URL.

Booking context is resolved only from the requested locale's published Prisma service
content. The booking page shows a concise approved-content service/procedure summary. Unknown
services become generic booking visits; invalid/stale procedure indices fall back to the
validated parent service. `POST /api/booking` accepts an optional `procedureIndex`, resolves
it again server-side, and persists nullable procedure index/title/price snapshots separately
from client notes. Confirmation, staff/CRM views, confirmation/reminder messages, and staff
notifications show the procedure snapshot when present and otherwise fall back to the parent
service.

> **First iteration (lean): implemented at reduced scope.** A friction-free, one-click
> booking: a 3-step wizard **Service → Time → You** where tapping a service selects it and
> advances; service cards and pages deep-link `/booking?service=<key>` to preselect. Steps:
> pick date/time (open slots only, single shared default practitioner) → client details
> (create/match CRM `Client`) → **GDPR consent** → **on-screen confirmation**, persisted via
> Prisma (`Appointment` + `Consent`). The clinic scheduling relation remains internal for
> persistence, conflict prevention, reschedule/cancel, and Phase 6 email/SMS
> confirmations + reminders.
> Mobile-first; 44px+ tap targets; clear progress indicator.

**Client wizard (24/7):** select treatment → choose date/time (only open slots) → client
details (create/match CRM client) → confirm + GDPR consent → on-screen confirmation. New
public bookings always resolve the exact **Mone Beauty Clinic** practitioner server-side;
legacy practitioner query/body values never control assignment. Provider identity is not
returned in public slot or confirmation responses. Shared-clinic availability and lightweight
cancel/reschedule endpoints remain implemented internally. Email + SMS
confirmations, reminders at 24h + 2h, and staff alerts are implemented through the Phase 6
notification layer; richer cutoff policy remains deferred to a future admin policy pass.
Mobile-first; 44px+ tap targets; clear three-step progress indicator; accent selected-state
calendar.

**Staff flow (`/staff`):** implemented as an internal shared-clinic schedule surface with a
custom date picker, working-hour range application, open/closed slot controls, and appointment
details (client + treatment + notes). Auth/RBAC and new-booking
notifications are implemented. Fully responsive.

## 9. CRM / client database

Client profile: full name, phone, email; appointment history (treatments, dates, status);
free-text notes; **contraindications / medical comments: flagged,
high-visibility, treated as special-category data**; cancellation/reschedule history.
Quick search by name / phone / email. Admin can create/edit clients and add notes.

## 10. Custom admin / CMS (Prisma)

User-friendly admin panel (custom, Prisma-backed) to edit text, images, pricing, services,
products, and blog without a developer. Hosts the CRM and the chatbot handoff queue.
**Roles:** admin (full), staff (own schedule + own appointments), client (account only).
Access control + **audit logging** on medical fields.

### 10.1 Localized admin IA and application shell

- The admin uses the same Finnish path segments in every locale. Finnish has no prefix;
  English and Russian use `/en` and `/ru`. Canonical modules are `/admin`,
  `/admin/kirjaudu`, `/admin/asiakkaat`, `/admin/ajanvaraukset`, `/admin/tilaukset`,
  `/admin/palvelut`, `/admin/teknologiat`,
  `/admin/sisalto`, `/admin/tuotteet`, `/admin/hinnasto`, `/admin/artikkelit`, and
  `/admin/keskustelut`; creation uses `/uusi` and records use `/[id]`.
- Existing English admin paths permanently redirect to the matching Finnish path.
- The desktop admin has a left sidebar that collapses to a 76px icon rail and remembers the
  preference across visits. Below desktop it becomes an accessible off-canvas drawer with
  overlay, focus containment, Escape close, and 44px controls.
- Admin navigation, forms, validation, confirmations, status and empty-state labels, login,
  dashboard, and dates are localized through the `Admin` message namespace. Locale changes
  preserve the Finnish path, record id, query string, and editor context.
- Public and admin route groups have separate shells. Admin never loads the public header,
  footer, cart, chatbot, cookie banner, or analytics.

### 10.2 Database content ownership and publication

- `Service` (clinical service), `Technology` (clinical technology), and `Product`
  (professional product) are separate Prisma entities with global operational fields and
  locale-specific content rows.
- Every locale-specific page, treatment, technology, product, price label, and article has a
  `DRAFT` or `PUBLISHED` state. Public queries return only the requested locale's published
  content; missing/draft translations are omitted or produce a localized 404. There is no
  translation generation and no fallback to English or another locale.
- Services own slug/path/category/duration/booking/price/media/order/practitioner/archive
  fields. Technologies own path/media/order and an optional related booking service.
  Products own price/currency/size/media/category/order/archive fields. Pricing keeps numeric
  values and relationships global while labels and units are localized.
- Services and products referenced by appointments or orders cannot be hard-deleted; they are
  archived. Historical appointment relations and order-item snapshots remain intact.
- All mutations require admin authorization, validate input, write `AuditLog`, and revalidate
  affected public and admin paths. Media inputs are restricted to existing `/media/**` paths.
- Homepage sections, service and technology pages, catalog, pricing, blog, booking,
  notifications, and chatbot retrieval use shared Prisma repositories at runtime.
- `content/generated/*.json` is import/bootstrap input only. Routine synchronization creates
  missing rows without overwriting admin-owned values; an explicit force option is required
  to refresh existing records.

## 11. AI chatbot

Floating FAB on every page (design in homepage spec). Answers questions, explains
procedures, helps choose treatments, gives pre/post-care **from approved content only**,
assists booking (launches the wizard), and **hands off to a human admin**. Languages:
**RU / FI / EN** (match locale). Implemented with the **Claude API**, system prompt grounded
in CMS content (retrieval) so it never fabricates medical claims. Log transcripts with consent.

## 12. SEO

Dedicated page per treatment; per-page SEO title + meta description; image `alt` everywhere;
correct heading order (single `h1`, ordered `h2/h3`); fast loading; blog for content
marketing; **local SEO: Helsinki** (`LocalBusiness`/`MedicalClinic` JSON-LD with NAP +
hours + geo); GA4 + Search Console; XML sitemap + robots.txt.

## 13. GDPR / security

SSL everywhere; cookie-consent banner; privacy/terms/cookies pages; lawful-basis + consent
capture at booking and checkout (granular marketing consent); right to access/erase/export;
medical notes encrypted at rest with strict RBAC + audit logging; EU data residency.

## 14. Non-deviation

Read `SCOPE.md`, this file, and `IMPLEMENTATION_PLAN.md` before any build work. Any scope,
stack, or design change must update these documents first. Full guardrails are mirrored in
`CLAUDE.md` and `AGENTS.md`.
