-- Raw SQL check constraints and partial unique indexes as specified in documentation Section 4.6 & Appendix

-- 1. Owner check on AvailabilitySlot: exactly one owner
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT IF EXISTS chk_slot_owner;
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT chk_slot_owner 
  CHECK ((professor_id IS NOT NULL AND committee_id IS NULL) OR (professor_id IS NULL AND committee_id IS NOT NULL));

-- 2. Slot shape check: single vs recurring
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT IF EXISTS chk_slot_shape;
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT chk_slot_shape
  CHECK (
    (slot_type = 'single' AND slot_date IS NOT NULL AND recurrence_pattern IS NULL) OR
    (slot_type = 'recurring' AND recurrence_pattern IS NOT NULL AND valid_from IS NOT NULL AND valid_until IS NOT NULL AND valid_until >= valid_from)
  );

-- 3. Working hours window check: 08:00 to 17:00, end after start
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT IF EXISTS chk_slot_times;
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT chk_slot_times
  CHECK (start_time >= '08:00' AND end_time <= '17:00' AND end_time > start_time);

-- 4. No double booking: Partial unique index on (slot_id, scheduled_date) where status is assigned or confirmed
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_slot_date_active 
  ON "DefenseSession"(slot_id, scheduled_date) 
  WHERE status IN ('assigned', 'confirmed');

-- 5. One active request per student: Partial unique index where status is requested, assigned, or confirmed
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_active_student 
  ON "DefenseSession"(student_id) 
  WHERE status IN ('requested', 'assigned', 'confirmed');

-- 6. Case-insensitive unique usernames and committee names
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_username_ci 
  ON "User"(LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS uq_committee_name_ci 
  ON "Committee"(LOWER(name));
