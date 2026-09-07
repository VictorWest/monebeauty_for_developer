# Milestone: Phase 3 Booking Upgrade

Status: implemented, automated verification passed. Manual browser/API smoke remains optional.

## What Was Already Done Before This Milestone

- [x] Lean booking existed at `/booking`.
- [x] `content/booking-services.ts` defined the bookable service registry.
- [x] `POST /api/booking` persisted `Client`, `Appointment`, and `Consent`.
- [x] `GET /api/booking/slots` generated simple business-hour slots.
- [x] Prisma already had `Practitioner`, `Availability`, `Appointment`, `Client`, and `Consent`.

## Phase 3 Implementation Checklist

- [x] Add practitioner-aware booking server logic.
- [x] Add eligible practitioner lookup by service.
- [x] Add `GET /api/booking/practitioners?service=<key>`.
- [x] Upgrade `GET /api/booking/slots` to accept `practitioner=<id|any>`.
- [x] Make `Availability.slots` the source of open slots when availability exists.
- [x] Keep generated business-hour fallback for practitioners without seeded availability.
- [x] Filter slot results by existing non-cancelled appointment overlaps.
- [x] Add “no preference” practitioner assignment.
- [x] Upgrade `POST /api/booking` to accept `practitionerId` or `any`.
- [x] Revalidate selected slot at submit time.
- [x] Add `POST /api/booking/cancel`.
- [x] Add `POST /api/booking/reschedule`.
- [x] Upgrade `BookingWizard` to Service -> Specialist -> Time -> You.
- [x] Preserve `/booking?service=<key>` preselection.
- [x] Show practitioner name in slot choices and confirmation summary.
- [x] Update `prisma/seed.ts` to connect services to the default practitioner.
- [x] Update `prisma/seed.ts` to create near-term development availability.
- [x] Add EN/FI/RU translations for the specialist step.

## Verification Checklist

- [x] `npm run lint`
- [x] `npm run build`
- [ ] Manual smoke: `/booking?service=laser` preselects service, loads specialists, books a slot.
- [ ] Manual smoke: second booking for the same practitioner/time is rejected.
- [ ] Manual smoke: cancel endpoint validates reference + contact and cancels appointment.
- [ ] Manual smoke: reschedule endpoint validates reference + contact and moves appointment.
- [ ] Manual smoke at 390px mobile viewport.

## Deferred Work

- [ ] Staff schedule UI for editing availability (`/staff`) — Phase 4.
- [ ] Email/SMS confirmations and reminders — Phase 6.
- [ ] Authenticated account booking history — Phase 5.
- [ ] Admin appointment management — Phase 5.

## Resume Notes

- Practitioner/slot logic lives in `lib/booking.ts`.
- Practitioner endpoint lives in `app/api/booking/practitioners/route.ts`.
- Cancel/reschedule endpoints live under `app/api/booking/{cancel,reschedule}`.
- Client wizard lives in `components/booking/BookingWizard.tsx`.
- Seeded availability is development-only bootstrap data until `/staff` exists.
