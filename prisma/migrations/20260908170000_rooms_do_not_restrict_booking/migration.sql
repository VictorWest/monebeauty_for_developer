-- Rooms must never restrict online booking availability (per updated
-- requirements). The application no longer treats a room as busy when
-- generating or confirming a slot, so this database-level exclusion
-- constraint would otherwise still reject two specialists booked into the
-- same room at overlapping times -- exactly the case the requirement says
-- must be allowed ("rooms are allocated internally... depending on the
-- situation on the day").
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_buffered_room_no_overlap";
