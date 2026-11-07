-- Evidence read model for AMP for Schools. Rollups key on the learner, so they
-- survive transfers and class changes, and cascade from amp_learners so the
-- existing deletion and retention paths reach them.
CREATE TABLE amp_skill_days (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  day date NOT NULL,
  skill_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  independent integer NOT NULL DEFAULT 0,
  assisted integer NOT NULL DEFAULT 0,
  review integer NOT NULL DEFAULT 0,
  review_independent integer NOT NULL DEFAULT 0,
  PRIMARY KEY(learner_id,day,skill_id)
);
CREATE TABLE amp_active_days (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  day date NOT NULL,
  surface text NOT NULL CHECK(surface IN ('practice','lesson','feedback','map','other')),
  skill_id text NOT NULL DEFAULT '',
  active_ms bigint NOT NULL DEFAULT 0 CHECK(active_ms>=0),
  PRIMARY KEY(learner_id,day,surface,skill_id)
);
CREATE TABLE amp_level_days (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  day date NOT NULL,
  frontier jsonb NOT NULL,
  policy_version text NOT NULL,
  PRIMARY KEY(learner_id,day)
);

-- A school student's answer adds to that day's rollup, with the day in the
-- school's timezone. A family learner has no amp_people row and costs one
-- index miss. Independent matches 0079: correct, unassisted, full weight.
CREATE FUNCTION amp_update_skill_days() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  zone text;
  is_correct boolean := COALESCE((NEW.outcome->>'correct')::boolean,false);
  is_assisted boolean := COALESCE((NEW.outcome->>'assisted')::boolean,false);
  is_independent boolean;
  is_review boolean;
BEGIN
  SELECT timezone INTO zone FROM amp_people WHERE learner_id=NEW.learner_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  is_independent := is_correct AND NOT is_assisted
    AND COALESCE((NEW.outcome->>'evidenceWeight')::numeric,1)>=1;
  SELECT COALESCE(content->'selection'->>'reason'='review',false) INTO is_review
    FROM amp_instances WHERE id=NEW.problem_id;
  is_review := COALESCE(is_review,false);
  INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent)
  VALUES(NEW.learner_id,((NEW.outcome->>'createdAt')::timestamptz AT TIME ZONE zone)::date,NEW.outcome->>'skillId',
    1,is_correct::int,is_independent::int,is_assisted::int,is_review::int,(is_review AND is_independent)::int)
  ON CONFLICT(learner_id,day,skill_id) DO UPDATE SET
    attempts=amp_skill_days.attempts+1,
    correct=amp_skill_days.correct+EXCLUDED.correct,
    independent=amp_skill_days.independent+EXCLUDED.independent,
    assisted=amp_skill_days.assisted+EXCLUDED.assisted,
    review=amp_skill_days.review+EXCLUDED.review,
    review_independent=amp_skill_days.review_independent+EXCLUDED.review_independent;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_attempt_skill_days AFTER INSERT ON amp_attempts
  FOR EACH ROW EXECUTE FUNCTION amp_update_skill_days();
