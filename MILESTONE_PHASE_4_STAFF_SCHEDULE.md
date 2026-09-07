# Milestone: Phase 4 Staff Schedule

Status: implemented, automated verification passed. Manual browser smoke remains optional.

## What Was Already Done Before This Milestone

- [x] Phase 3 booking supports practitioner-aware slots.
- [x] Prisma has `Practitioner`, `Availability`, `Appointment`, and `StaffUser`.
- [x] Seed creates a default practitioner and near-term availability.
- [x] Booking slot lookup reads `Availability.slots` when present.

## Phase 4 Implementation Checklist

- [x] Add `/staff` page in the locale app.
- [x] Add noindex metadata for the staff page.
- [x] Add staff schedule API at `/api/staff/schedule`.
- [x] Support daily schedule read by practitioner and date.
- [x] Return day appointments with client and service context.
- [x] Return availability slots with booked status overlaid from appointments.
- [x] Support saving a single day’s open/closed slot state.
- [x] Support applying working-hour patterns across a future date range.
- [x] Build practitioner selector.
- [x] Build date selector.
- [x] Build working-hours editor.
- [x] Build daily slot open/closed controls.
- [x] Show booked appointment rows with client contact and notes.
- [x] Add EN/FI/RU staff UI translations.
- [x] Keep auth/RBAC deferred to Phase 5.
- [x] Phase 5 follow-up completed: `/staff` and `/api/staff/schedule` are now role-gated.

## Verification Checklist

- [x] `npm run lint`
- [x] `npm run build`
- [ ] Manual smoke: open `/staff`, select practitioner/date, view slots.
- [ ] Manual smoke: close a slot, save, then verify `/booking` no longer offers it.
- [ ] Manual smoke: apply working hours across a range and reload the selected day.
- [ ] Manual smoke at 390px mobile viewport.

## Deferred Work

- [x] Auth and role gating — completed in Phase 5.
- [x] Staff users seeing only their own practitioner schedule — completed in Phase 5.
- [ ] New-booking notifications — Phase 6.
- [ ] Rich weekly calendar visualization.
- [ ] Break/day-off presets beyond manually closing slots.

## Resume Notes

- Staff API lives in `app/api/staff/schedule/route.ts`.
- Staff UI lives in `components/staff/StaffSchedule.tsx`.
- Shared slot helpers live in `lib/staff-schedule.ts`.
- Phase 5 added auth/RBAC; use an admin or linked staff account for `/staff`.
