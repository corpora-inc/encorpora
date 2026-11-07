-- An adult's own learner (docs/families.md): owned by the adult's account and
-- marked adult. It has no birth year; the adult chooses where to begin, and
-- learns on their own account's terms, so no parental consent applies. Its day
-- boundary is the adult's own time zone, taken when they start.
ALTER TABLE amp_learners
  ADD COLUMN adult boolean NOT NULL DEFAULT false,
  ADD COLUMN timezone text,
  ADD CONSTRAINT amp_learners_adult_no_birth_year CHECK (NOT adult OR birth_year IS NULL),
  ADD CONSTRAINT amp_learners_timezone_adult CHECK (timezone IS NULL OR adult);
-- One live adult learner per account. A deleted one keeps its tombstone.
CREATE UNIQUE INDEX amp_learners_one_adult_idx ON amp_learners(account_id)
  WHERE adult AND deleted_at IS NULL;

-- Where an adult begins: the family bands, plus course-shaped starts that map
-- onto the same grade axis (src/learning/starting-point.ts).
ALTER TABLE amp_learners DROP CONSTRAINT amp_starting_point_valid;
ALTER TABLE amp_learners ADD CONSTRAINT amp_starting_point_valid CHECK (
  (starting_band IS NULL AND starting_policy IS NULL AND starting_excluded_strands IS NULL)
  OR (starting_band IN ('K–2','3–5','6–8','9–12',
        'counting','elementary','middle-school','algebra-1','geometry','algebra-2','precalculus')
    AND starting_policy = 1
    AND starting_band IS NOT NULL AND starting_policy IS NOT NULL
    AND starting_excluded_strands IS NOT NULL
    AND cardinality(starting_excluded_strands) <= 64
    AND array_position(starting_excluded_strands,NULL) IS NULL)
);

-- An adult's answers roll up like a school student's, in their own time zone,
-- so their record and their class's map read the same facts. A child learner
-- still costs one index miss on amp_people and one primary-key read here.
CREATE OR REPLACE FUNCTION amp_update_skill_days() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  zone text;
  is_correct boolean := COALESCE((NEW.outcome->>'correct')::boolean,false);
  is_assisted boolean := COALESCE((NEW.outcome->>'assisted')::boolean,false);
  is_independent boolean;
  is_review boolean;
BEGIN
  SELECT timezone INTO zone FROM amp_people WHERE learner_id=NEW.learner_id;
  IF NOT FOUND THEN
    SELECT COALESCE(timezone,'America/New_York') INTO zone FROM amp_learners
      WHERE id=NEW.learner_id AND adult;
    IF NOT FOUND THEN RETURN NEW; END IF;
  END IF;
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

-- When an adult's active time was last credited, so one heartbeat can claim no
-- more than the time since the last (a student's session row does this for
-- students). One row per adult learner, never shared.
CREATE TABLE amp_adult_activity (
  learner_id text PRIMARY KEY REFERENCES amp_learners(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL
);
