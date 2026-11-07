-- The school and district layer. One small rollup: a learner's week, so a
-- district's overview reads about a dozen rows per student instead of every
-- day, surface and skill. It is one row per learner, so practice writes no
-- shared row, and it cascades from amp_learners like the rollups it sums.
CREATE TABLE amp_learner_weeks (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  -- The Monday, in the school's timezone: the day rows already are.
  week date NOT NULL,
  active_ms bigint NOT NULL DEFAULT 0 CHECK(active_ms>=0),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  PRIMARY KEY(learner_id,week)
);
CREATE FUNCTION amp_add_active_week() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  added bigint := NEW.active_ms;
BEGIN
  IF TG_OP='UPDATE' THEN added := NEW.active_ms-OLD.active_ms; END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,active_ms)
  VALUES(NEW.learner_id,date_trunc('week',NEW.day)::date,GREATEST(added,0))
  ON CONFLICT(learner_id,week) DO UPDATE
    SET active_ms=GREATEST(amp_learner_weeks.active_ms+added,0);
  RETURN NEW;
END $$;
CREATE TRIGGER amp_active_days_week AFTER INSERT OR UPDATE OF active_ms ON amp_active_days
  FOR EACH ROW EXECUTE FUNCTION amp_add_active_week();
CREATE FUNCTION amp_add_attempts_week() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  added integer := NEW.attempts;
BEGIN
  IF TG_OP='UPDATE' THEN added := NEW.attempts-OLD.attempts; END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,attempts)
  VALUES(NEW.learner_id,date_trunc('week',NEW.day)::date,GREATEST(added,0))
  ON CONFLICT(learner_id,week) DO UPDATE
    SET attempts=GREATEST(amp_learner_weeks.attempts+added,0);
  RETURN NEW;
END $$;
CREATE TRIGGER amp_skill_days_week AFTER INSERT OR UPDATE OF attempts ON amp_skill_days
  FOR EACH ROW EXECUTE FUNCTION amp_add_attempts_week();
INSERT INTO amp_learner_weeks(learner_id,week,active_ms,attempts)
SELECT learner_id,week,sum(active_ms)::bigint,sum(attempts)::int FROM (
  SELECT learner_id,date_trunc('week',day)::date AS week,active_ms,0 AS attempts FROM amp_active_days
  UNION ALL
  SELECT learner_id,date_trunc('week',day)::date,0,attempts FROM amp_skill_days
) facts GROUP BY learner_id,week;

-- An overview reads this week and last week across a whole district, and each
-- student's first and latest level this term. Both come straight off an index:
-- no heap and no JSON for 10,000 students.
CREATE INDEX amp_learner_weeks_week_idx ON amp_learner_weeks(week,learner_id) INCLUDE (active_ms,attempts);
ALTER TABLE amp_level_days
  ADD COLUMN overall_level real GENERATED ALWAYS AS ((frontier->'overall'->>'level')::real) STORED;
CREATE INDEX amp_level_days_overall_idx ON amp_level_days(learner_id,day) INCLUDE (overall_level);

-- Which outside sign-ins a school has turned on: 'google', 'microsoft'. The
-- join screen and the flow both read it, so the flow can't reach another school.
ALTER TABLE amp_orgs ADD COLUMN sign_in_providers text[] NOT NULL DEFAULT '{}';

-- The year a copied class came from, walked when a year rolls over.
CREATE INDEX amp_classes_rolled_from_idx ON amp_classes(rolled_from) WHERE rolled_from IS NOT NULL;
CREATE INDEX amp_classes_session_idx ON amp_classes(session_id);
CREATE INDEX amp_academic_sessions_parent_idx ON amp_academic_sessions(parent_id) WHERE parent_id IS NOT NULL;

-- The activity log pages by (at, id) at the database, and finds a person fast.
DROP INDEX amp_school_events_org_idx;
CREATE INDEX amp_school_events_org_idx ON amp_school_events(org_id,"at" DESC,id DESC);
CREATE INDEX amp_school_events_actor_idx ON amp_school_events(actor_person_id,"at" DESC) WHERE actor_person_id IS NOT NULL;
CREATE INDEX amp_school_events_target_idx ON amp_school_events(target_id,"at" DESC);
