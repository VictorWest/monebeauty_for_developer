# Milestone: Phase 5 CRM + Custom Admin + Auth

Status: implemented, automated verification passed. Database migration and content sync must
be run in each target environment before admin content editing is usable.

## What Was Already Done Before This Milestone

- [x] Phase 2 e-commerce cart, checkout, `Order`, `OrderItem`, and GDPR consent persistence.
- [x] Phase 3 practitioner-aware booking, availability-backed slots, cancel/reschedule APIs.
- [x] Phase 4 staff schedule UI and `/api/staff/schedule`.
- [x] Prisma already had core `User`, `Client`, `Service`, `Product`, `PricingItem`,
      `Article`, `Consent`, and `AuditLog` models.

## Phase 5 Implementation Checklist

- [x] Add Prisma `Session` model for durable auth sessions.
- [x] Add Prisma `ContentPage` model for editable scraped-content overrides.
- [x] Add migration `20260702090000_phase5_auth_admin`.
- [x] Add password hashing/verification, session cookie handling, role guards, and audit helper.
- [x] Add `/admin/login` and `/admin/logout`.
- [x] Seed first admin from `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optional `ADMIN_NAME`.
- [x] Add `npm run db:sync-content` to seed `ContentPage`, `Product`, and `ProductContent`
      from committed generated JSON.
- [x] Protect `/staff` for `ADMIN` and `STAFF`.
- [x] Protect `/api/staff/schedule` for `ADMIN` and `STAFF`.
- [x] Restrict staff users to their linked `Practitioner` schedule.
- [x] Add `/admin` dashboard.
- [x] Add `/admin/clients` quick search by name, email, or phone.
- [x] Add `/admin/clients/[id]` CRM profile, notes, consent, appointments, orders, and
      contraindications.
- [x] Audit contraindication view and update events.
- [x] Add `/admin/services` service metadata editor.
- [x] Add `/admin/content` and `/admin/content/[id]` generated-page content editor.
- [x] Add `/admin/products` product and localized product-content editor.
- [x] Add `/admin/pricing` pricing-item editor.
- [x] Add `/admin/blog` article and localized article-content editor.
- [x] Make public content pages prefer Prisma `ContentPage` rows with generated JSON fallback.
- [x] Make catalog/product pages prefer Prisma product rows with generated JSON fallback.
- [x] Make checkout server totals resolve products from Prisma when available.
- [x] Exclude `/admin` from locale middleware.
- [x] Update roadmap and project agent docs.

## Verification Checklist

- [x] `npm run db:generate`
- [x] `npm run lint`
- [x] `npm run build`
- [ ] Run `npm run db:migrate` against the target `DATABASE_URL`.
- [ ] Run `npm run db:seed` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set.
- [ ] Run `npm run db:sync-content`.
- [ ] Manual smoke: sign in at `/admin/login`.
- [ ] Manual smoke: anonymous user cannot access `/admin`.
- [ ] Manual smoke: anonymous user cannot access `/fi/staff`.
- [ ] Manual smoke: staff user can access `/fi/staff` but not `/admin`.
- [ ] Manual smoke: edit a content page and verify the public page changes.
- [ ] Manual smoke: edit product price/content and verify catalog/product page changes.
- [ ] Manual smoke: view/edit client contraindications and verify `AuditLog` rows.
- [ ] Manual smoke at 390px mobile viewport for admin forms.

## Deferred Work

- [ ] Password reset and invite flow for staff/admin users.
- [ ] Client account UI.
- [ ] Encryption-at-rest policy for special-category CRM fields.
- [ ] Admin image upload/media library.
- [ ] Delete/archive flows for admin records.
- [ ] Payment capture and order confirmation email.
- [ ] Email/SMS booking confirmations and reminders - Phase 6.

## Resume Notes

- Auth helpers live in `lib/auth.ts`.
- Live content/product fallback helpers live in `lib/live-content.ts`.
- Admin routes live under `app/admin/(protected)/`.
- Admin content sync lives in `scripts/sync-cms-from-generated.ts`.
- Apply the migration before relying on Prisma content overrides; before migration, public
  pages intentionally fall back to committed generated JSON during build/render.
