-- Demo places (docs/schools.md#demo-places): a teacher or school leader
-- explores a fully alive class or school before any agreement or payment.
-- A demo org and everything in it is synthetic: never billed, counted, mailed
-- or converted. It belongs to the account that made it (`created_by`), one per
-- kind, and goes with all its data when that account removes it or after 30
-- days without a visit (`demo_seen_at`, the retention job).
ALTER TABLE amp_orgs
 ADD COLUMN demo boolean NOT NULL DEFAULT false,
 ADD COLUMN demo_kind text CHECK (demo_kind IN ('class','school')),
 ADD COLUMN demo_seen_at timestamptz,
 ADD CONSTRAINT amp_orgs_demo_shape CHECK (
   (demo AND demo_kind IS NOT NULL AND demo_seen_at IS NOT NULL AND parent_id IS NULL
     AND created_by IS NOT NULL AND kind='school')
   OR (NOT demo AND demo_kind IS NULL AND demo_seen_at IS NULL));
CREATE UNIQUE INDEX amp_orgs_demo_owner_idx ON amp_orgs(created_by,demo_kind) WHERE demo;
CREATE INDEX amp_orgs_demo_seen_idx ON amp_orgs(demo_seen_at) WHERE demo;

-- A demo student's practice is covered by a `demo` grant: never revenue, and
-- never the free allowance. The wider check goes on without a scan (every row
-- already meets the narrower one), then is validated under SHARE UPDATE
-- EXCLUSIVE rather than a scan under ACCESS EXCLUSIVE.
ALTER TABLE amp_grants DROP CONSTRAINT amp_grants_channel_check;
ALTER TABLE amp_grants ADD CONSTRAINT amp_grants_channel_check
 CHECK (channel IN ('pilot','stripe','apple','google','esa','demo')) NOT VALID;
ALTER TABLE amp_grants VALIDATE CONSTRAINT amp_grants_channel_check;

-- A bulk writer of rollups (a demo's twelve weeks, a fixture's district) sums
-- the weeks once at the end instead of row by row: inside its transaction it
-- sets `amp.rollup_weeks` to 'deferred'. Practice never sets it.
CREATE OR REPLACE FUNCTION amp_add_active_week() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  added bigint := NEW.active_ms;
BEGIN
  IF current_setting('amp.rollup_weeks',true)='deferred' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN added := NEW.active_ms-OLD.active_ms; END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,active_ms)
  VALUES(NEW.learner_id,date_trunc('week',NEW.day)::date,GREATEST(added,0))
  ON CONFLICT(learner_id,week) DO UPDATE
    SET active_ms=GREATEST(amp_learner_weeks.active_ms+added,0);
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION amp_add_attempts_week() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  added integer := NEW.attempts;
BEGIN
  IF current_setting('amp.rollup_weeks',true)='deferred' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN added := NEW.attempts-OLD.attempts; END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,attempts)
  VALUES(NEW.learner_id,date_trunc('week',NEW.day)::date,GREATEST(added,0))
  ON CONFLICT(learner_id,week) DO UPDATE
    SET attempts=GREATEST(amp_learner_weeks.attempts+added,0);
  RETURN NEW;
END $$;
