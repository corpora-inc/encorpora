-- Every learner is measured the same way (docs/engagement-measurement.md,
-- "Learning measurement").
--
-- The rollups (0087, 0090, 0111) always keyed on amp_learners.id, which every
-- learner has. What kept a learner out was the day boundary: the answer
-- trigger, the level day and the print recorder each looked for a time zone
-- only on a roster row (amp_people, a school's or a family's class) or on an
-- adult's own learner, and wrote nothing without one. A child practicing on a
-- parent's account outside a family class, or a trial, got answers and no
-- rollups. The heartbeat had the same gap one level up: its clock was a
-- student's session or an adult's row, so no one else's time was sent.
--
-- Now one function names every learner's day, and one clock serves every
-- learner an account practices as.

-- A learner's calendar day zone: the class roster's (a school's or a family's,
-- as before), else the learner's own (an adult's), else the family's, else the
-- account's adult's, else the zone an adult without one already gets. Each
-- step is one index probe and runs only when the one before found nothing, so
-- a rostered student's answer costs what it did.
CREATE FUNCTION amp_learner_zone(learner text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  zone text;
  account text;
BEGIN
  SELECT timezone INTO zone FROM amp_people WHERE learner_id=learner;
  IF zone IS NOT NULL THEN RETURN zone; END IF;
  SELECT l.timezone,l.account_id INTO zone,account FROM amp_learners l WHERE l.id=learner;
  IF zone IS NOT NULL THEN RETURN zone; END IF;
  IF account IS NULL THEN RETURN 'America/New_York'; END IF;
  SELECT o.timezone INTO zone FROM amp_families f JOIN amp_orgs o ON o.id=f.org_id
    WHERE f.account_id=account;
  IF zone IS NOT NULL THEN RETURN zone; END IF;
  SELECT a.timezone INTO zone FROM amp_learners a
    WHERE a.account_id=account AND a.adult AND NOT a.simulation AND a.deleted_at IS NULL;
  RETURN COALESCE(zone,'America/New_York');
END $$;

-- Every answer rolls up, in its learner's day.
CREATE OR REPLACE FUNCTION amp_update_skill_days() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  zone text := amp_learner_zone(NEW.learner_id);
  is_correct boolean := COALESCE((NEW.outcome->>'correct')::boolean,false);
  is_assisted boolean := COALESCE((NEW.outcome->>'assisted')::boolean,false);
  help jsonb := CASE WHEN jsonb_typeof(NEW.outcome->'help')='array' THEN NEW.outcome->'help' ELSE '[]'::jsonb END;
  is_independent boolean;
  is_review boolean;
BEGIN
  is_independent := is_correct AND NOT is_assisted
    AND COALESCE((NEW.outcome->>'evidenceWeight')::numeric,1)>=1;
  SELECT COALESCE(content->'selection'->>'reason'='review',false) INTO is_review
    FROM amp_instances WHERE id=NEW.problem_id;
  is_review := COALESCE(is_review,false);
  INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent,
    with_hint,with_lesson,with_video,with_example,with_person)
  VALUES(NEW.learner_id,((NEW.outcome->>'createdAt')::timestamptz AT TIME ZONE zone)::date,NEW.outcome->>'skillId',
    1,is_correct::int,is_independent::int,is_assisted::int,is_review::int,(is_review AND is_independent)::int,
    (help ? 'hint')::int,(help ? 'lesson')::int,(help ? 'video')::int,(help ? 'example')::int,(help ? 'person')::int)
  ON CONFLICT(learner_id,day,skill_id) DO UPDATE SET
    attempts=amp_skill_days.attempts+1,
    correct=amp_skill_days.correct+EXCLUDED.correct,
    independent=amp_skill_days.independent+EXCLUDED.independent,
    assisted=amp_skill_days.assisted+EXCLUDED.assisted,
    review=amp_skill_days.review+EXCLUDED.review,
    review_independent=amp_skill_days.review_independent+EXCLUDED.review_independent,
    with_hint=amp_skill_days.with_hint+EXCLUDED.with_hint,
    with_lesson=amp_skill_days.with_lesson+EXCLUDED.with_lesson,
    with_video=amp_skill_days.with_video+EXCLUDED.with_video,
    with_example=amp_skill_days.with_example+EXCLUDED.with_example,
    with_person=amp_skill_days.with_person+EXCLUDED.with_person;
  RETURN NEW;
END $$;

-- Backfill: the answers the old trigger skipped, rolled up as the trigger
-- above rolls up a new one. An answer was skipped when, as it was stored, its
-- learner had no roster row yet and was not yet an adult (an adult is one
-- from creation, or from the adoption of the trial it was). A roster row can
-- also be let go of later (a child removed from another family's class),
-- which hides that its answers did roll up, so no day may end up counting
-- more answers than are stored for it: a (learner, day, skill) whose rollup
-- plus the backfill would exceed its stored answers is left as it was. An
-- answer stored before the first rollup (0087) by a learner already rostered
-- then is left as it was too. Weeks follow from the day rows' own trigger.
-- Level days, active time and help were never sent for these learners, so
-- nothing here can recreate them.
WITH since AS (
  SELECT l.id,amp_learner_zone(l.id) AS zone,
    LEAST(
      COALESCE((SELECT p.created_at FROM amp_people p WHERE p.learner_id=l.id),'infinity'),
      CASE WHEN NOT l.adult THEN 'infinity'::timestamptz
        ELSE COALESCE((SELECT max(t.adopted_at) FROM amp_trials t WHERE t.learner_id=l.id),'-infinity') END
    ) AS rolled_from
  FROM amp_learners l WHERE l.deleted_at IS NULL
), stored AS (
  SELECT a.learner_id,
    ((a.outcome->>'createdAt')::timestamptz AT TIME ZONE s.zone)::date AS day,
    a.outcome->>'skillId' AS skill_id,
    a.created_at<s.rolled_from AS skipped,
    COALESCE((a.outcome->>'correct')::boolean,false) AS correct,
    COALESCE((a.outcome->>'assisted')::boolean,false) AS assisted,
    COALESCE((a.outcome->>'correct')::boolean,false)
      AND NOT COALESCE((a.outcome->>'assisted')::boolean,false)
      AND COALESCE((a.outcome->>'evidenceWeight')::numeric,1)>=1 AS independent,
    COALESCE(i.content->'selection'->>'reason'='review',false) AS review,
    CASE WHEN jsonb_typeof(a.outcome->'help')='array' THEN a.outcome->'help' ELSE '[]'::jsonb END AS help
  FROM amp_attempts a
  JOIN since s ON s.id=a.learner_id
  LEFT JOIN amp_instances i ON i.id=a.problem_id
  -- The trigger would refuse an answer without these; none should lack them.
  WHERE a.outcome->>'skillId' IS NOT NULL AND a.outcome->>'createdAt' IS NOT NULL
), bucket AS (
  SELECT learner_id,day,skill_id,count(*)::int AS answers,
    count(*) FILTER (WHERE skipped)::int AS attempts,
    count(*) FILTER (WHERE skipped AND correct)::int AS correct,
    count(*) FILTER (WHERE skipped AND independent)::int AS independent,
    count(*) FILTER (WHERE skipped AND assisted)::int AS assisted,
    count(*) FILTER (WHERE skipped AND review)::int AS review,
    count(*) FILTER (WHERE skipped AND review AND independent)::int AS review_independent,
    count(*) FILTER (WHERE skipped AND help ? 'hint')::int AS with_hint,
    count(*) FILTER (WHERE skipped AND help ? 'lesson')::int AS with_lesson,
    count(*) FILTER (WHERE skipped AND help ? 'video')::int AS with_video,
    count(*) FILTER (WHERE skipped AND help ? 'example')::int AS with_example,
    count(*) FILTER (WHERE skipped AND help ? 'person')::int AS with_person
  FROM stored GROUP BY learner_id,day,skill_id
)
INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent,
  with_hint,with_lesson,with_video,with_example,with_person)
SELECT b.learner_id,b.day,b.skill_id,b.attempts,b.correct,b.independent,b.assisted,b.review,b.review_independent,
  b.with_hint,b.with_lesson,b.with_video,b.with_example,b.with_person
FROM bucket b
LEFT JOIN amp_skill_days r ON r.learner_id=b.learner_id AND r.day=b.day AND r.skill_id=b.skill_id
WHERE b.attempts>0 AND COALESCE(r.attempts,0)+b.attempts<=b.answers
ON CONFLICT(learner_id,day,skill_id) DO UPDATE SET
  attempts=amp_skill_days.attempts+EXCLUDED.attempts,
  correct=amp_skill_days.correct+EXCLUDED.correct,
  independent=amp_skill_days.independent+EXCLUDED.independent,
  assisted=amp_skill_days.assisted+EXCLUDED.assisted,
  review=amp_skill_days.review+EXCLUDED.review,
  review_independent=amp_skill_days.review_independent+EXCLUDED.review_independent,
  with_hint=amp_skill_days.with_hint+EXCLUDED.with_hint,
  with_lesson=amp_skill_days.with_lesson+EXCLUDED.with_lesson,
  with_video=amp_skill_days.with_video+EXCLUDED.with_video,
  with_example=amp_skill_days.with_example+EXCLUDED.with_example,
  with_person=amp_skill_days.with_person+EXCLUDED.with_person;

-- When a learner's active time was last credited, for every learner an
-- account practices as (its children, its adult, its practice profiles), so
-- one heartbeat claims no more than the time since the last. A school
-- student's session row does this for students. amp_adult_activity, the
-- adult-only clock it replaces, is no longer written; its rows start this one.
-- Last in the migration: its foreign key locks writes to amp_learners until
-- the migration commits, so that is held only briefly.
CREATE TABLE amp_learner_activity (
  learner_id text PRIMARY KEY REFERENCES amp_learners(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL
);
INSERT INTO amp_learner_activity(learner_id,seen_at)
SELECT learner_id,seen_at FROM amp_adult_activity;
