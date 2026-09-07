# Calendar and Appointment Booking Review for Project Owner

**Prepared:** 22 July 2026

**Purpose:** Confirm the clinic's real scheduling rules before the calendar and public booking system are treated as production-ready.

## Note to the project owner

The application already has a strong foundation for a multi-employee clinic calendar. It can maintain separate employee calendars, assign services to qualified employees, associate services with treatment rooms and physical devices, and prevent overlapping reservations for an employee, room, or device. The public booking flow intentionally remains **Service → Time → You**: clients do not choose an employee, and the system assigns an available qualified employee automatically.

The remaining issue is that the clinic's real operating rules have not yet been fully configured or, in a few cases, cannot be represented by the current data model. We need the decisions below to ensure that the times shown to clients are genuinely bookable based on the complete combination of:

- a qualified employee;
- that employee's working schedule;
- a suitable and available treatment room; and
- every required physical device.

The intended rule should be:

> A time is shown to a client when at least one complete, valid employee + room + required-device combination is available for the entire treatment. The time is hidden only when no valid combination remains.

For example, if the same treatment can be performed by Employee A in Room 1 and Employee B in Room 2, both appointments should be possible at 10:00 when both complete combinations are free. If Employee A or Room 1 becomes occupied, 10:00 should remain available through Employee B and Room 2.

## What the application currently supports

- Four active employee calendars are present: Ilona Bagaturija, Irene, Vladislava, and Inna.
- Every service can be assigned to multiple qualified employees.
- Every service can be assigned to one or more allowed rooms and compatible devices.
- Each appointment reserves one employee, one room, and, when required, one device.
- Employee, room, and device overlaps are checked during public booking and internal calendar changes.
- PostgreSQL overlap constraints protect appointments from double-booking the same employee, room, or device.
- Transaction locks and shared conflict checks also account for internal calendar blocks such as breaks, errands, and leave.
- Employee schedules support recurring working days and hours, plus exact per-date workday overrides.
- The admin calendar provides day, week, and month views and permits appointment creation, movement, resource selection, and schedule management.
- Staff access is restricted to the calendar belonging to the employee linked to that staff account.
- Public clients see the union of available times across qualified employees without seeing or selecting the employee.

The automated test suite currently passes all 140 tests. However, many calendar tests verify code structure and rules statically; they do not constitute full database-backed concurrency, daylight-saving-time, or end-to-end capacity testing.

## Current configuration found in the database

The current database is configured as follows:

- All four active employees are assigned to all eight bookable services.
- No employee has an explicit recurring schedule saved. They therefore inherit the default Monday–Saturday, 10:00–19:00 pattern.
- All eight bookable services are assigned to only **Treatment room 1**.
- Endospheres, Laser, and MicroRF each have one physical device record.
- Other bookable services have no device requirement.
- Existing availability rows cover only a limited future period and largely reproduce the default schedule.

This means that, despite having four employees, the current configuration permits only **one clinic appointment at a time**, because all treatments compete for the same room. The application cannot provide simultaneous appointments until the real rooms, device units, employee qualifications, and service mappings are entered.

The seed/provisioning process also assigns all active employees to all bookable services. This bootstrap behavior must not overwrite the clinic-approved qualification matrix in production.

## Gaps and risks requiring attention

### 1. Recurring employee schedules are too simple

An employee can select working weekdays, but all selected weekdays share one start and end time, in whole hours. The recurring model cannot currently express examples such as:

- Monday 09:00–17:00;
- Tuesday 12:00–20:00;
- Wednesday off;
- Thursday 09:30–17:30; or
- a split shift with a recurring break.

Per-date overrides can express an exact 15-minute-aligned range, but they are exceptions rather than a reusable weekday schedule.

### 2. Service mappings assume every selected resource is interchangeable

Qualified employees, allowed rooms, and allowed devices are saved as three independent lists. The scheduler therefore assumes any selected employee can use any selected room and any selected device for that service.

It cannot express a rule such as:

- Employee A may perform the treatment only in Room 1 with Device 1; while
- Employee B may perform it only in Room 2 with Device 2.

If the clinic has restrictions at this level, an explicit service-capability combination is required instead of the current Cartesian-product assumption.

### 3. Equipment capacity is not fully modeled

The present model treats each device record as one exclusive physical resource and allows an appointment to reserve at most one device. It does not distinguish clearly between an equipment type and an individual unit, and it cannot directly express:

- three interchangeable units of one device type;
- a treatment requiring two devices simultaneously;
- a device permanently installed in one room;
- employee certification for a particular device;
- device setup or cleaning time; or
- standalone device/room maintenance without also blocking an employee.

If there are multiple identical physical devices, each could be entered as a separate record, but the required naming, room compatibility, and allocation policy must be agreed.

### 4. Broad services and individual procedures share one scheduling rule

The public site can show procedure variants inside a service, but the calendar uses the parent service's duration, employee list, rooms, and device rule. Procedure variants cannot currently have independent durations or resource requirements.

This matters if, for example, different laser areas, facial treatments, or packages require different durations, equipment, rooms, or qualifications.

### 5. Configuration changes can invalidate future appointments

Some workday operations correctly reject a change that would leave an active appointment outside the new workday. However, recurring-hours updates and calendar setup changes do not consistently provide the same protection.

Deactivating an employee can hide that employee's future appointments from the active shared-calendar query. Removing an employee, room, or device from a service can also leave future appointments referring to a combination that is no longer valid. Production behavior should require reassignment or explicit resolution before such a change is accepted.

### 6. Helsinki time and daylight-saving time are inconsistent

The scheduling engine currently treats a displayed clinic wall-clock time as though it were UTC. Other parts of the application, including appointment communications, format the stored timestamp in `Europe/Helsinki`.

During Finnish daylight-saving time, a slot generated and labelled as 10:00 can consequently be interpreted as 13:00 in Helsinki. Browser timezone differences can create additional inconsistencies. Appointment instants, calendar views, messages, reminders, and calendar-file links need one DST-safe Helsinki conversion policy.

### 7. Public availability calculation is query-heavy

To determine available dates, the application recalculates each day separately and repeats service, employee, availability, appointment, block, room, and device queries. A normal booking calendar may evaluate up to 60 days.

This should be replaced with a genuinely batched availability query/calculation before production traffic. The current implementation can become slow as employee, appointment, service, and resource counts grow.

### 8. Concurrent booking may not retry every valid resource combination

The transaction safely rejects a resource that another booking has just taken. However, the candidate list generally carries only the first room and first device found for each employee. If two clients book the same time concurrently, the second request may report that the slot was taken instead of retrying another still-free room or device for the same employee/service combination.

The final allocator should generate or select a complete alternative combination inside the locked transaction.

### 9. Additional edge cases need behavioral tests

Database-backed tests should cover:

- two simultaneous bookings using different employees and rooms;
- contention for the last device;
- alternate resource allocation after a concurrent booking;
- employee, appointment, room, device, and internal-block conflicts together;
- schedule changes when future appointments exist;
- Finnish DST transitions and clients in other browser timezones;
- service/procedure duration coverage across closed gaps; and
- resource deactivation or qualification changes with future appointments.

## Questions requiring owner decisions

Please provide the real employee schedules (including different weekday hours, breaks, exceptions, and split shifts) and the definitive list of bookable treatments with their durations, setup/cleanup buffers, and qualified employees. We also need the room and equipment inventory: which treatments and employees can use each room, whether equipment records represent types or individual physical units, how many units exist, whether a treatment can require multiple devices, whether devices are fixed to particular rooms, and whether rooms or devices need independent maintenance closures. Please confirm whether these rules apply to broad services or to each individual procedure variant, and provide several real examples where the same treatment can occur simultaneously with different employees and rooms.
