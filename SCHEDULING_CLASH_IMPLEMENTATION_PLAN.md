# Scheduling and Resource-Clash Implementation Plan

**Approved direction:** 22 July 2026

## Objective

Public booking remains **Service → Time → You**. A public time is available only when at least one complete qualified employee, room, and required-device allocation is available for the full treatment. The client never selects or supplies those internal resources; assignment is recalculated and persisted atomically.

Admins manage every employee, recurring schedule, date exception, qualification, room, device, and service/resource mapping. Staff may manage only their linked employee's recurring hours, date exceptions, internal blocks, and personal calendar preferences. Clinic-wide configuration remains admin-only.

## Scheduling model

- Store a versioned `Europe/Helsinki` weekly schedule in `Practitioner.workingHours`, with independent 15-minute-aligned intervals for each weekday and support for split shifts. Read the legacy `openDays/startHour/endHour/stepMin` shape during migration.
- Treat an explicit `Availability` row as the complete override for that employee/date. Empty intervals mean closed.
- Version one reserves exactly one qualified employee and one room for each appointment, plus zero or one required physical device. Rooms and devices are exclusive resources.
- Qualifications and resources apply at parent-service level until procedure-specific clinic rules are supplied.
- Keep the engine internally expressed as allocation candidates so later appointment segments, multiple participants, or multiple devices can extend it without replacing clash detection.

## Availability and allocation

- Batch-load the service, ordered qualified employees, schedules, overrides, appointments, internal blocks, allowed rooms, and devices for the requested date range.
- Generate every valid employee × room × device candidate for every 15-minute start where the full duration is continuously covered.
- Remove candidates overlapping an active appointment or internal block for any allocated employee, room, or device.
- Return public slots deduplicated by start time and without internal resource identifiers.
- On create, move, or approved reschedule, acquire sorted transaction-scoped PostgreSQL advisory locks, reload conflicts, and try every valid candidate before returning `slot_taken`.
- Use the same engine for public booking, internal appointment create/move, client reschedule approval, date availability, and scheduling pickers.

## Time policy

- Interpret all calendar dates and wall-clock inputs in `Europe/Helsinki`; store real UTC instants.
- Generate public labels, admin/staff calendar positions, email/SMS times, reminders, and calendar links from the same clinic-time utilities.
- Reject nonexistent spring DST wall times and handle repeated autumn wall times consistently.

## Administration and safety

- Reuse one weekday-interval editor for admins editing any employee and staff editing only themselves.
- Allow admin management of employee metadata, service qualifications, rooms, devices, and required-device mappings.
- Reject deactivation or mapping removal that would invalidate an active future appointment; return an affected count for resolution.
- Mark services without a qualified employee, room, or required device as scheduling-incomplete and expose no public availability.
- Prevent production bootstrap from assigning all staff to all services automatically.

## Verification

- Prove simultaneous bookings with different employee/room combinations, fallback after each resource class conflicts, last-capacity rejection, internal-block conflicts, and concurrent allocation.
- Prove admin-all/staff-own RBAC at the API boundary.
- Cover weekday-specific and split schedules, date overrides, Finnish DST boundaries, and consistent notification/calendar times.
- Bound public 60-day availability query counts and verify mobile/desktop admin and staff workflows in FI/EN/RU.

## Pending owner response

The implementation does not block on whether a clinical appointment can require several employees or sequential treatments using changing resources. Version one retains the current single-employee/single-service appointment persistence while keeping allocation and conflict interfaces extensible.
