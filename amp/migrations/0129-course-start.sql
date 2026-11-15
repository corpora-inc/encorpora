-- Metadata-only addition: no default, constraint validation, or learner backfill.
-- Existing evidence derives its legacy fallback lazily, under the learner lock.
ALTER TABLE amp_learners ADD COLUMN starting_course_level double precision;

-- Expand/enable rollout: keep false while any legacy learning reader is live.
-- Disabling selection does not remove the need to read already frozen starts.
CREATE TABLE amp_course_placement (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO amp_course_placement DEFAULT VALUES;

-- Old API writers participate without knowing this column exists. A first
-- legacy answer freezes the implicit fallback before a later course can apply.
CREATE FUNCTION amp_freeze_legacy_course_start() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE amp_learners SET starting_course_level=2
    WHERE id=NEW.learner_id AND starting_course_level IS NULL
      AND NOT adult AND birth_year IS NULL AND starting_band IS NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_freeze_legacy_course_start BEFORE INSERT ON amp_attempts
  FOR EACH ROW EXECUTE FUNCTION amp_freeze_legacy_course_start();
