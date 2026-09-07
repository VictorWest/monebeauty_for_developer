Project Overview
Independent admin and client sessions (owner-approved 2026-08-27): client and back-office
authentication use separate, audience-scoped, versioned HTTP-only cookies so a client account and
an administrator/staff account can remain signed in in the same browser. Public pages, booking,
checkout, and `/oma-tili` use only the client audience; admin and staff surfaces use only the
back-office audience. Logging out of one audience must not end the other audience's session.
Role/status validation prevents a cookie or session from crossing portal boundaries.

The existing `Session` table remains unchanged. A temporary role-checked fallback reads the prior
shared `mone_session_v2` cookie when the requested scoped cookie is absent so active sessions
survive deployment. New logins do not clear that shared cookie. Audience logout removes a legacy
session only when its current user role belongs to the same audience. Password resets and explicit
administrator revocation continue to delete every session for the affected user record.

Consultation during first booking and verified reconciliation (owner-approved 2026-08-28):
keep the four-step **Procedure -> Specialist -> Date & Time -> You/Confirm** flow and collect the
versioned consultation inside the final step before appointment creation. Every guest completes or
reconfirms date of birth, the live required health questions, health-data consent, and the accuracy
acknowledgment on every booking. Signed-in clients skip the form only when their encrypted profile
is current and readable; missing, stale, or unreadable profiles are completed inline without an
account-page redirect. Configuration/version drift or unavailable encryption fails closed before
the appointment transaction and shows the clinic phone/email fallback.

Guest consultation data is encrypted on the guest CRM client. After verified email ownership,
guarded email/phone history reconciliation selects the newest readable consultation submission,
relinks consultation and appointment consent history, transfers the canonical profile to the
registered client, and removes superseded guest profiles. Audit events contain the match method but
no values. A current decryptable consultation bound to a valid appointment claim may replace the
ordinary registration consultation form: its email is locked to the claim and the transfer happens
only after verification. Invalid, expired, stale, ambiguous, or unreadable claims use the normal
registration form. Ordinary registration submissions remain canonical when newer.

Online booking specialist selection and consultation profile (owner-approved 2026-08-26):
`online_booking_system_technical_requirements.pdf` is the newest authority for online booking and
supersedes every earlier automatic-clinic-assignment or hidden-practitioner direction. The public
flow is **Procedure -> Specialist -> Date & Time -> You/Confirm**. A deep-linked exact procedure
starts at Specialist; one active, procedure-qualified specialist is selected automatically, more
than one requires an explicit selection, and zero uses the localized phone/email fallback. There
is no "no preference" choice. Public names are Ilona, Irena, Inna, and Vladislava; internal names,
resource identifiers, and the preparation/cleaning buffer remain private.

Qualification is exact-option data independent of the employee/service/room/device capability
tuple. Public availability requires both an active option qualification and a complete effective
capability. Every new or changed appointment reserves its employee, room, and device through the
visible procedure end plus a non-editable 15-minute buffer. The visible end, customer duration,
messages, and calendar attachment exclude that buffer. Existing production assignments and
capabilities must be preserved by guarded, idempotent migration; unique Irene records become Irena
without changing identity or relations, and inferred option qualifications are backfilled for
later admin review. Deployment must stop when a dry-run preflight finds future reservations less
than 15 minutes apart.

Guest booking remains available with the existing contact, GDPR-consent, and claim-link behavior.
Authenticated clients use server-owned verified contact details and must have a current encrypted
consultation profile before booking. Registration collects separate first/last name, date of birth,
configured localized health questions, explicit health-data consent, and an accuracy acknowledgment.
Existing clients complete or reconfirm the versioned form in `/oma-tili` when a stricter required
question invalidates their profile. Each booking also snapshots a separate, versioned,
procedure-specific acknowledgment. Date of birth and health answers use AES-256-GCM under the
required `SENSITIVE_DATA_ENCRYPTION_KEY`; plaintext is excluded from logs, notifications, chatbot
knowledge, and audit metadata. Authorized back-office profile/appointment views and client
self-service may decrypt it, with every back-office view and mutation audited. GDPR export includes
readable consultation data and wording snapshots; erasure destroys the profile and redacts consent
linkage while retaining value-free security audits.
Endospheres booking handoff (owner-approved, 2026-08-13): the Endospheres service-page CTA uses
service-specific FI/EN/RU copy and retains the active URL locale. A direct localized booking URL with
`service=endospheres` resolves the published Endospheres parent even though that parent remains hidden
from the general service picker, and asks the visitor to choose among its published duration options
without preselecting one. Booking presentation uses the selected service's managed hero, focal point,
and localized alt text; the global booking hero is used only when no valid selected-service image is
available. This is a presentation/context change only, with no schema, migration, scheduling, or
booking API change.

Body Treatments Endospheres mirror (owner-approved, 2026-08-13): keep both public routes, but render
`/palvelut/vartalohoidot` from the exact same requested-locale published Endospheres service record as
`/palvelut/endospheres-terapia`. The mirror includes the complete Endospheres hero, H1, summary,
overview, editorial and managed imagery, booking CTA, treatment/course cards, option links, and
conditional before/after gallery. It uses the Endospheres metadata, social image, structured data,
canonical URL, and hreflang URLs; the duplicate Body Treatments landing URL is excluded from the
sitemap. Navigation and the service index keep the Body Treatments label and URL, and its stored
database content and option-detail routes remain intact but are not rendered on that landing page.
If the requested locale's Endospheres record is unavailable or unpublished, return 404 without
cross-locale or Body Treatments fallback. This supersedes the appended-content implementation. The
dedicated Endospheres route remains unchanged.

Shared back-office access (owner-approved, 2026-08-01): active staff with a permanent password
use the localized `/admin` workspace and receive every administrator read/write capability,
including CRM/GDPR actions, staff-account security, payments/refunds, publishing/media,
configuration, calendars/resources, orders, appointments, and chat archive. The only exclusions
are the raw Audit Logs, global Integration Logs, and audit export, which remain administrator-only.
Staff retain a localized My settings destination for their own email/password, profile, schedule,
and capabilities. `/henkilosto` redirects authenticated staff into `/admin`; its dedicated login
and forced temporary-password replacement routes remain supported. Record-specific delivery
history remains visible in its owning order, appointment, or chat. Security and integration
events continue to be recorded with the staff actor even though staff cannot browse the raw logs.
This direction supersedes earlier staff-own-calendar and admin-only business/configuration limits.

Admin-managed public imagery (owner-approved, 2026-08-01): every visitor-facing content photo,
hero, card image, treatment/course image, editorial image, Markdown image, video poster, and social
preview is editable from the relevant admin page. One image selection is shared across FI/EN/RU;
meaningful images require localized alt text, decorative images are explicitly marked, and cropped
frames expose horizontal and vertical focal-point controls. Services, options, technologies,
products, articles, content pages, homepage sections, booking, and Endospheres editorial media all
use persisted managed values. Existing visuals are backfilled without changing appearance and
content synchronization never overwrites unrelated admin media edits. Brand logos, favicon, icons,
decorative vectors/CSS, email branding, and the homepage video remain code-owned.

Service treatment details (owner-approved, 2026-08-01; expanded 2026-08-01): every published `/palvelut/*` category
page uses one mobile-first template: one hero image, title and summary; a short approved overview;
responsive treatment/course cards with localized group, name, complete-block extractive summary, duration, price,
and separate localized detail and quick-book actions; then the remaining approved benefits, results, safety, aftercare,
and FAQ. Each card opens a dedicated `/palvelut/<service-slug>/<option-key>` page containing the
complete same-locale source description and the booking action. Every published treatment and
course is directly bookable from its category card with `service` and stable `option` identity.
Cards may include their admin-managed treatment image, are one column at 390 px, and expand to two or three columns where space permits; a sole
option remains a polished full-width card. Code-owned treatment-card imagery, hero booking actions,
index-based public booking links, and treatment cards without a quick-book action remain
superseded. Device-treatment and trichology routes retain
their current information-first selector presentation.

Every published treatment option contains localized Markdown covering what the treatment is and
how it works, suitability, benefits, expected results and the recommended course,
safety/contraindications, preparation, and aftercare; FAQ is included where useful source material
exists. This directly published copy is owner-editable. Facts follow this authority order: clinic
PDFs/documents; existing same-locale Mone Beauty copy; official manufacturer documentation; then
authoritative medical or public-health sources. A committed enrichment registry and provenance
manifest identify the sources used for each option. Model-authored organization and translation
may express those recorded facts but must not introduce unsupported medicines, dosages,
credentials, guarantees, medical claims, or prices. Packages and unspecified injectable choices
state that procedure-specific suitability, safety, and contraindications are confirmed during the
individual assessment instead of presenting a universal list.

Treatment and course choices are normalized database-owned service options with stable keys, localized
names/groups/duration and price labels, a complete same-locale source paragraph or semantic list block as the
extractive card summary, complete source Markdown and
source provenance, server-owned booking duration, publication/archive state,
and appointment, course, or legacy informational-package type. Every published active appointment
or course has a server-owned duration and is bookable. Duration ranges reserve their published maximum.
Course cards reserve the first visit only: Endospheres and other duration-labelled courses use
their published 30/45/60/75-minute visit; AROSHA and laser courses use 60 minutes; fractional
mesotherapy uses 60 minutes; and Reset uses the Packages service's 90 minutes. Remaining sessions
are arranged with the clinic. Booking begins on the detail page with the service and option
preselected and opens at Date & Time. New appointments snapshot the selected option, published course
price, and first-visit duration while preserving legacy procedure fields for history. Detail-page
booking links use `?service=<slug>&option=<stable-key>` and open the wizard at Date & Time; legacy
`procedure=<index>` links continue resolving when possible.

Category heroes contain only the short summary. Each category then presents a distinct,
admin-editable, same-locale overview in `TreatmentContent.whatItIs`; generated source aggregates
and repeated summaries are not rendered. Endospheres uses a structured localized editorial layout
after its treatment grid, with alternating text sections, a benefit grid, and no more than three
real images in bounded 4:3 frames. English follows the approved PDFs; Finnish and Russian remain
grounded in their respective scraped pages.

Treatment names and summaries are never shortened by generated ellipses, token/word limits, or visual
line clamps. Summary generation selects exactly the first complete coherent paragraph or semantic list block
from the same-locale source. Benefits, advantages, results, course, safety, and other structural headings are
detail content and never part of the hero summary. The dedicated detail page retains the complete description
below the hero and consumes the complete matching Markdown prefix, including a multi-block/list summary,
rather than repeating the hero copy.

Packages options come from a source-attributed canonical registry rather than positional locale
alignment. Semantic keys merge locales only when the source describes the same course, preserve
locale-only courses without fallback, and replace superseded generated records through a guarded,
idempotent migration that never overwrites unrelated admin edits. Ordinary options match by
localized name, group, price, and legacy index; packages use their semantic-key registry. Only
empty or known source-owned values are populated, preserving locale-only, archived, and
admin-edited records. Each canonical course also owns
its scheduling-service target, so Endospheres and laser courses reserve their required device and
qualified resources while AROSHA, facial, and other courses use their approved service capability.

Cancellation policy (client-approved, 2026-07-31): appointments must be cancelled or
rescheduled at least 24 hours before the booked time. Changes made less than 24 hours in
advance but before the appointment date incur 50% of the service price. Same-day changes and
no-shows incur 100%. The policy is published consistently in Finnish, English, and Russian on
the website and in appointment emails. Appointment payments remain outside Stripe; the clinic
administers any cancellation fee manually.

Endospheres content and pricing (client-approved, 2026-07-30): repository-root
`Endospheres_Therapy_Website_Content_Mone_Beauty_Clinic.pdf` and
`Endospheres_Website_Spec_for_Developer.pdf` are the newest authority for English
Endospheres copy, registered marks, treatment durations, introductory offer, and prices.
They supersede scraped English Endospheres copy and pricing where they conflict. Finnish
and Russian translations remain review-only until clinic approval. The €99 introductory
75-minute offer is active until withdrawn, is limited to clients without a prior
non-cancelled Endospheres-family appointment, and requires a signed-in client account.
All offers, including future offers, require account creation or sign-in. Endospheres
appointments and packages are paid at the clinic and never enter Stripe checkout.

Employee-owned configuration and unified staff management (owner-directed, 2026-07-22):
employees manage their own account name, login email/password, professional profile, calendar
color, split-shift weekly schedule, date exceptions, qualified services, and service-specific
room/device capabilities. Admin -> Staff is the single complete employee editor and retains
account status, activation, display/allocation order, password reset, session revocation, audit,
and credential deletion. Calendar Setup retains only global services, rooms, devices, and block
templates. A versioned `PractitionerServiceCapability` is the sole source of qualification and
resource allocation; edits are optimistic, immediate, audited, limited to each service's active
resource pool, and rejected when they would invalidate an active future appointment. Staff never
manage other employees, global inventory, activation, account status, or allocation priority.

Complete resource-safe scheduling (owner-directed, 2026-07-22): public booking remains
Service -> Time -> You and exposes a time only when a complete qualified employee, room, and
required physical-device allocation covers the treatment. Admins configure every employee,
weekly schedule, date exception, qualification, room, device, and service mapping; staff may
change only their linked employee's recurring hours, date exceptions, internal blocks, and
calendar preferences. Allocation is recalculated inside the locked transaction and exhausts
alternative employees/rooms/devices before reporting a clash. Clinic wall times use
`Europe/Helsinki` with DST-safe UTC persistence. Version one retains one employee, one service,
one room, and zero/one device per appointment while the owner confirms whether simultaneous
employees or sequential clinical treatments are ever required.

Stripe website payments (owner-approved, 2026-07-19): product purchases use Stripe-hosted
Checkout and webhook-authoritative payment state. The online catalog supports physical
products, balance gift cards, and single-use prepaid treatment vouchers, with free clinic
pickup or a Stripe-configured Finland shipping rate for physical goods. Payment success,
refunds, voucher issuance/redemption, fulfilment, and localized customer/staff notifications
are persisted and audited. Returning from an unpaid hosted Checkout expires that session;
the signed webhook cancels the order, while admin views expose an Awaiting payment state and
filter for open website orders. Ordinary appointment bookings remain unpaid online and are paid
at the clinic by credit card; the system never sends a Stripe invoice after an appointment.

Account portals and staff operational access (owner-approved, 2026-07-19; expanded
2026-08-01): clients may create
verified accounts without being required to sign in before booking. `/oma-tili` shows the
authenticated client's past and upcoming procedures and submits cancellation/reschedule
requests for admin approval. After initial email verification and every successful client
login, guest orders and appointments are attached when their normalized snapshot email or
phone matches the account, without changing their immutable contact snapshots. Verified email
ownership takes precedence over phone matching, and records owned by another registered account
are never transferred. Existing single-use appointment claim links remain supported for old
emails but are idempotent and cannot override account ownership. `/oma-tili` shows all linked
orders, including unsuccessful and terminal orders, and accepts one pending 3–500 character
order-cancellation request when fulfilment has not shipped, completed, or already been cancelled.
Only admins approve or reject order requests. Approval expires open unpaid Stripe Checkout,
cancels unpaid legacy orders, or initiates an idempotent refund for the entire remaining Stripe
balance; signed Stripe webhooks remain authoritative for paid-order cancellation and refund
finalization. Admin and staff use separate login surfaces. Admins create
staff credentials and the matching private calendar employee in one step, choose a non-empty
temporary password, and manage every staff account. Back-office users may reset passwords, revoke
sessions or access, reactivate accounts, and delete credentials while retaining calendar and
appointment history; staff must replace the temporary password on first login and receive no
confirmation email. Staff use the shared back-office workspace and may manage every employee,
calendar, business record, website module, account, resource, and clinic configuration. Raw audit
and global integration logs remain admin-only, and
sensitive access/security events are recorded in an immutable admin-visible audit log.

Shared calendar and employee-owned booking (owner-approved, 2026-07-19): the admin exposes
`/admin/kalenteri` as a Timma-inspired shared day/week/month calendar. All active employees
are visible in separate time-based columns; appointment cards show client, procedure, room,
and time. Bookable services share an ordered qualified employee roster. Public booking remains
Service -> Time -> You and exposes no employee picker; for each chosen time the server assigns
the first available qualified employee in calendar display order. Admins may move appointments between qualified employees;
staff may create and move appointments only within their linked employee calendar and compatible
rooms/devices. The calendar exposes a
Create appointment action and empty available times can be clicked to prefill a new booking.
The appointment editor selects existing CRM clients through an accessible dropdown with 300 ms
debounced name, phone, or email lookup and no manual search button. Opening the dropdown shows
the 20 most recently updated active clients. Name, phone, and email remain visible and editable
after selection; clearing a selection clears those fields. The values saved on an appointment
are booking-only contact snapshots and never overwrite the linked CRM client.
Staff availability changes remain restricted to the employee linked to their own account.
Rooms and physical treatment devices are separate exclusive resources, so employee, room,
and device overlaps are rejected server-side and at the database boundary.

Timma-style calendar and internal reservations (owner-approved, 2026-07-21):
`/admin/kalenteri` is a full-height, dense day/week/month workspace inside the existing Mone
admin shell. It has generated active-employee filters, sticky employee/time axes, persisted
compact/default/expanded zoom, working-time-union cropping, desktop-fit day/week columns,
responsive horizontal scrolling below desktop widths, and a mobile service tray. Day columns
are per employee; week columns are grouped by weekday and employee; month cells use compact rows
with overflow disclosure. The collapsed desktop icon rail reserves 76 px; expanding the sidebar
overlays the calendar without resizing or shifting it. Mone design tokens remain authoritative
for the visual treatment.

The localized internal calendar-service catalog is generated from `internal-services.txt` and
forms a separate unavailable-time reservation layer. Its first four entries (lunch break,
personal time, work errand, and sick leave) are selected by default; vacation and every other
entry remain available but unselected. The Edit dialog lists the complete catalog and lets each
user keep up to 24 shortcuts with independently editable Finnish, English, and Russian drag labels
no longer than 14 characters. The catalog, dialog controls, shortcut rail, and drag preview follow
the active interface locale while the approved Finnish names and aliases remain unchanged. These
entries never enter clinical services, client histories,
receipts, reminders, or treatment content. Admins configure template labels, color, duration,
order, and active state; staff may use active templates only.
Dragging or selecting a template and choosing a quarter-hour position inside a visible one-hour
calendar row opens a localized
Booking info editor for sequential items, employee, optional room or device, notes, and repeat/
add-to-others. Recurrence supports weekdays, an end date no more than 12 months away, admins'
multi-employee assignment, staff-own-only assignment, atomic conflict validation, and at most
500 occurrences. Blocks can be moved, edited, or soft-cancelled for one occurrence or all future
occurrences with optimistic version checks and audit records, without customer notifications.
Day and week calendars fit all selected employee/date columns into the available desktop grid;
below desktop widths they scroll horizontally inside the grid. They use page-level vertical
scrolling, and month dates remain navigable even without working hours or events. Empty
quarter-hour positions support vertical click-drag selection locked to the starting date/employee
column. The complete range renders as one continuous shaded block without internal grid borders
and opens Create appointment immediately on release. Its dragged duration overrides the service
default for that staff-created appointment only.
All appointment and block mutation paths share employee/room/device overlap checks and
transaction-scoped PostgreSQL advisory locks so cross-type reservations cannot race. Internal
blocks do not rewrite canonical working hours or `Availability.slots`. Active practitioners
continue to populate the calendar automatically in display order; login access and calendar
visibility remain separate controls.

Per-date workdays (owner-approved, 2026-07-21): the shared-calendar toolbar removes granular
Open / closed times and provides tooltiped Add workday and Remove workday actions. Add replaces
one employee/date availability override with an exact 15-minute range; Remove stores an empty
override while leaving canonical weekly hours unchanged. Staff can change only their linked
employee and admins can select any active employee. Past dates and changes that would leave an
active appointment outside the resulting workday are rejected. Zoom uses localized, tooltiped
magnifying-glass minus/plus icons.

Expanded client account, saved details, and booking communications (owner-approved,
2026-07-19): `/oma-tili` is a localized account dashboard for verified identity details,
appointments and change requests, website orders, saved Finland delivery addresses, and profile
editing. Authenticated booking and checkout reuse the account's verified contact details; checkout
may reuse a saved address while Stripe still confirms the final order address. Appointment emails
use a branded booking card with full timing, service, employee, clinic address, map/calendar links,
pay-at-clinic information, the published cancellation policy, and a secure account-based cancel or
reschedule action.

External integration observability (owner-approved, 2026-07-19): server-side email, SMS, Stripe,
Anthropic, and Cloudinary attempts record redacted request/response metadata, provider identifiers,
HTTP outcomes, latency, retries, and related business entities. Admin-only integration logs retain
these records for 30 days; secrets, raw personal content, payment data, and authentication material
must never be persisted.

Admin operations (owner-approved, 2026-07-18): the multilingual custom admin includes
dedicated Orders (`tilaukset`) and Appointments (`ajanvaraukset`) modules. Submitted order
contents remain immutable; staff confirm, fulfil, or cancel requests and can send audited
transactional email/SMS. Appointment administration supports confirmation, availability-
validated rescheduling, completion, cancellation, reminders, and audited custom messages.
Customer-facing automatic messages use the record locale through Resend and Sinch.

Public booking assignment (owner-approved 2026-07-21): the customer flow remains Service ->
Time -> You and customers do not choose between employees. Each bookable service has an ordered
qualified employee roster. Availability is the union of conflict-free employee/resource slots;
creation assigns the first available employee in display order inside the locked booking
transaction. Historical appointment relations are preserved.

Themed controls (owner-approved, 2026-07-18): all dropdowns, calendars, and time pickers use
custom Mone Beauty controls. Compact fields use popovers and the booking calendar remains
inline; no native form select/date/time UI is exposed.

Admin visual system (owner-approved, 2026-07-21): admin login, navigation, dashboards, editors,
tables, calendars, forms, and modals use admin-only Inter typography with complete FI/EN/RU
glyph coverage. Operational icons use the existing Phosphor library at regular weight, with bold
reserved for active or selected states, consistent sizing, 44 px targets, localized accessible
labels, and hover/focus tooltips where the icon meaning is not visible. The public luxury
Cormorant/Jost typography and public marketing icon treatment remain unchanged.

Working-time-only calendars and pickers (owner-approved, 2026-07-19): weekly employee working
hours are persisted as the canonical schedule, with per-date availability as the override. Shared
day/week calendars show only the selected employees' open-time union. Unavailable dates remain
visible but disabled in date pickers, and appointment time controls omit non-working starts. The
working-hours configuration control retains full-day choices, and legacy appointments outside
current availability are surfaced separately rather than hidden.

Public URL architecture (owner-approved, 2026-07-17): every user-facing route uses the same
Finnish path segments in FI, EN, and RU; only the locale prefix changes. Finnish remains
unprefixed, while English and Russian use `/en` and `/ru`. Canonical shop paths are
`/verkkokauppa`, `/ostoskori`, `/kassa`, and `/tilaus`; booking is `/ajanvaraus`, services
are under `/palvelut`, device treatments are under `/laitehoidot`, and the staff portal is
`/henkilosto`. Existing English public paths permanently redirect to their Finnish
equivalents. API paths, admin paths, product/article slugs, database identifiers, and booking
query values remain stable.

Admin and runtime-content architecture (owner-approved, 2026-07-16; sidebar updated
2026-07-21): the custom Prisma admin is a responsive multilingual management application with
a desktop sidebar that collapses to a persistent icon rail and an accessible mobile drawer.
The desktop preference is remembered across visits. Admin path segments are Finnish in every
interface locale: Finnish
uses `/admin/...`, English `/en/admin/...`, and Russian `/ru/admin/...`; locale switching
preserves the route, record, query, and editor context. Clinical services, clinical
technologies, professional products, pricing, pages, and articles are distinct Prisma-backed
types with independently publishable EN/FI/RU content. Public runtime rendering reads
published content from PostgreSQL with no cross-locale fallback. Generated JSON and scraped
content are bootstrap/import sources only and routine imports never overwrite admin edits.

Homepage reference direction (owner-approved, 2026-07-12): the localized homepage reproduces
the rendered design, composition, and approved copy of repository-root `index.html`. All
medical, diagnostic, evidence-based, and licensing language in that reference is explicitly
owner-approved for homepage use and supersedes the previous homepage composition. Order:
centered real-video hero with three facts;
Standard of Care; clinical services (including source-backed assessment and safety framing for
otherwise unspecified medical options);
alternating technologies; AROSHA/DIXIDOX tabs; compact `/ajanvaraus?service=<key>` handoff; and
clinic standard/contact. The working booking wizard remains the only appointment flow.

Develop a website from scratch for Mone Beauty Clinic, an aesthetic medicine clinic. The website should be more than just a corporate presentation—it should serve as a comprehensive platform for:
Presenting the clinic
Showcasing services
Online appointment booking
Client database management
Client communication
SEO optimization
Staff workflow automation
⸻
Brand Positioning
Clinic Name: Mone Beauty Clinic Main Focus: Aesthetic Medicine Clinic Main Slogan: Next-Generation Aesthetic Medicine Subtitle: A comprehensive approach to beauty, skin health, and restoring the natural harmony of the face, body, and hair. The website should convey:
Premium quality
Trust
Medical expertise
Safety
Modernity
Elegance
Care
Personalized approach
⸻
Visual Style
The design should reflect:
Luxury minimalism
Scandinavian aesthetics
Clean medical beauty
Premium wellness
Contemporary European medical clinic
Color Palette
Milky white
Cream
Beige
Sand
Taupe
Soft brown
Subtle gold accents
Avoid:
Bright neon colors
Traditional pink beauty salon aesthetics
Cold hospital-like appearance
Heavy black backgrounds
Cheap stock photography
Overloaded layouts
⸻
Homepage
The homepage should be long-form, logically structured, and optimized for smooth scrolling. Section 1 — Hero Must include:
Mone Beauty Clinic logo
Main navigation
Online Booking button
Language switcher
Large premium hero image
Main headline
Hero Text Aesthetic Medicine Clinic Next-Generation Aesthetic Medicine A comprehensive approach to beauty, skin health, and restoring the natural harmony of the face, body, and hair.
Buttons:
Book Online
Our Services
⸻ Section 2 — Key Advantages Highlight:
Medical approach
Innovative technologies
Personalized treatment programs
Licensed medical clinic
Safe and evidence-based procedures
⸻ Section 3 — Our Services Each service should lead to its own dedicated page.
аппаратная косметология → Aesthetic Device Treatments
Laser Hair Removal
Endospheres Therapy
Microneedling RF
Facial Treatments
Body Treatments
Injectable Aesthetic Medicine
Trichology
Medical Consultation
⸻ Section 4 — About the Clinic Heading Beauty Backed by Science. Harmony Designed for You. Text Mone Beauty Clinic combines aesthetic medicine, advanced technologies, and a comprehensive approach to beauty, skin health, facial rejuvenation, body care, and hair restoration. Emphasize:
A medical clinic, not a beauty salon
Evidence-based medical approach
Licensed facility
Safe procedures
Advanced technologies
Personalized treatment plans
⸻ Section 5 — Technologies & Treatments Include:
Endospheres Therapy
Laser technologies
RF technologies
Aesthetic device treatments
Injectable procedures
Trichology
Facial treatments
Body treatments
Section 6 — Online Booking Dedicated CTA section: Book your consultation and receive personalized recommendations from our specialists. Button: Book Online ⸻ Section 7 — Footer Include:
Logo
Navigation
Contact information
Address
Phone
Email
Instagram
Facebook
WhatsApp
Online Booking
Privacy Policy
Terms of Use
⸻
Website Structure
Each page should be a standalone page. Required pages:
Home
About the Clinic
Services
Aesthetic Device Treatments
Laser Hair Removal
Endospheres Therapy
Microneedling RF
Facial Treatments
Body Treatments
Injectable Aesthetic Medicine
Trichology
Medical Consultation
Pricing
Blog / Articles
Contact
Online Booking
Privacy Policy
Terms of Use
Do not include a “Specialists” page. ⸻
Service Pages
Each treatment should have its own SEO-optimized page. Every page should include:
Treatment name
Short description
What the treatment is
Who it is suitable for
Benefits and concerns addressed
Procedure process
Why it is safe
Pre-treatment recommendations
Post-treatment recommendations
Contraindications
Recommended number of sessions
Expected results
FAQ
Online Booking button
Online Booking
This is one of the most important features. Client Features
Select treatment
Automatic clinic assignment (no public specialist selection)
Choose date and time
24/7 online booking
Email confirmation
SMS confirmation (preferred)
Appointment reminders
Reschedule or cancel appointments
Staff Features
Personal schedule access
Ability to manage working hours
Open/close appointment slots
View personal appointments
Notifications about new bookings
Mobile access
Daily and weekly calendar
⸻
CRM / Client Database
The website should include a convenient client management system. Each client profile should contain:
Full name
Phone number
Email
Appointment history
Treatments received
Treatment dates
Practitioner
Notes
Contraindications / important comments
Cancellation and rescheduling history
Quick search by name, phone number, or email
⸻
Chatbot
The website should include an AI-powered chatbot. Functions:
Answer customer questions
Explain procedures
Help clients choose treatments
Provide pre- and post-treatment recommendations
Assist with online booking
Transfer conversations to an administrator
Preferably support Russian, Finnish, and English
⸻
Website Languages
The website should ideally support three languages:
Russian
Finnish
English
The language switcher should be located in the website header. ⸻
Mobile Version
The website must be fully responsive and optimized for:
iPhone
Android devices
Tablets
Mobile-first design is essential, as most visitors will access the website from their smartphones. ⸻
SEO
The website should be fully optimized for Google. Requirements:
Dedicated page for each treatment
SEO titles
Meta descriptions
Image ALT text
Fast loading speed
Proper H1/H2/H3 heading structure
Blog / Articles
Local SEO targeting Helsinki
Google Analytics integration
Google Search Console integration
⸻
Technical Requirements
The website should include:
Modern CMS
User-friendly admin panel
Ability to edit text, images, pricing, and services
Fast loading speed
SSL certificate
GDPR compliance
Personal data protection
Email notification integration
SMS notification integration
Online booking integration
CRM integration
AI chatbot
Instagram and WhatsApp integration
⸻
Project Priorities
The key priorities of the project are:
Build the website from scratch.
Every service must have its own dedicated page.
The online booking system must be intuitive for both clients and staff.
Staff must be able to manage their own schedules.
The system must include a client database with treatment history.
The website must feature an AI chatbot to answer customer inquiries.
The overall experience should reflect a premium, modern, and medically credible aesthetic.
The design should avoid heavy black backgrounds and instead use a soft luxury beige color palette.
The website must be fully responsive and mobile-first.
The website must be fully prepared for long-term SEO growth.
