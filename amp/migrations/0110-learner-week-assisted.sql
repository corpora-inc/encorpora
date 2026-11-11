-- A school's weekly chart splits problems into those answered on their own and
-- those with a hint or lesson. The week rollup keeps the assisted count beside
-- its attempts, so the chart still reads one row per learner a week.
ALTER TABLE amp_learner_weeks
  ADD COLUMN assisted integer NOT NULL DEFAULT 0 CHECK(assisted>=0);
CREATE OR REPLACE FUNCTION amp_add_attempts_week() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  added integer := NEW.attempts;
  helped integer := NEW.assisted;
BEGIN
  IF current_setting('amp.rollup_weeks',true)='deferred' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    added := NEW.attempts-OLD.attempts;
    helped := NEW.assisted-OLD.assisted;
  END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,attempts,assisted)
  VALUES(NEW.learner_id,date_trunc('week',NEW.day)::date,GREATEST(added,0),GREATEST(helped,0))
  ON CONFLICT(learner_id,week) DO UPDATE
    SET attempts=GREATEST(amp_learner_weeks.attempts+added,0),
      assisted=GREATEST(amp_learner_weeks.assisted+helped,0);
  RETURN NEW;
END $$;
UPDATE amp_learner_weeks w SET assisted=s.assisted
FROM (
  SELECT learner_id,date_trunc('week',day)::date AS week,sum(assisted)::int AS assisted
  FROM amp_skill_days GROUP BY 1,2
) s
WHERE s.learner_id=w.learner_id AND s.week=w.week AND s.assisted>0;
