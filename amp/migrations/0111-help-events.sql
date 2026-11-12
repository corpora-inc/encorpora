-- Help a learner reaches for: lessons opened, hints revealed, worked
-- explanations opened, videos opened and lesson PDFs printed. Each is one
-- compact append-only row, written by the active-time heartbeat that already
-- runs (src/schools/help-events.ts), so recording them costs no extra request.
-- Reports never read these rows: a statement trigger rolls each insert into a
-- day row per kind and skill and into the learner's week, beside the minutes
-- and answers it already holds. Raw rows age out (RETENTION.helpEventDays);
-- the rollups stay with the learner's other learning records.
CREATE TYPE amp_help_kind AS ENUM ('lesson','hint','example','video','print');
CREATE TYPE amp_help_source AS ENUM ('practice','lessons','pathways','progress');

CREATE TABLE amp_help_events (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  "at" timestamptz NOT NULL,
  -- The calendar day in the learner's timezone, as the other day rollups.
  day date NOT NULL,
  kind amp_help_kind NOT NULL,
  source amp_help_source NOT NULL,
  -- The problem's skill, or the lesson's; '' when neither is known.
  skill_id text NOT NULL DEFAULT '',
  -- The problem type (template) or lesson the help belongs to.
  ref text NOT NULL DEFAULT '',
  problem_id text,
  -- A hint's step, from 1.
  step smallint CHECK(step IS NULL OR step BETWEEN 1 AND 20)
);
-- Export, cascade and per-learner reads; the BRIN keeps the retention sweep
-- off a full scan for a few kilobytes.
CREATE INDEX amp_help_events_learner_idx ON amp_help_events(learner_id,"at");
CREATE INDEX amp_help_events_at_idx ON amp_help_events USING brin("at");

CREATE TABLE amp_help_days (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind amp_help_kind NOT NULL,
  skill_id text NOT NULL DEFAULT '',
  opened integer NOT NULL DEFAULT 0 CHECK(opened>=0),
  PRIMARY KEY(learner_id,day,kind,skill_id)
);

-- Time on help uses the same heartbeat, idle rule and server cap as all active
-- time: the client names the surface that is showing (a hint, a video, a worked
-- explanation) instead of the route's.
ALTER TABLE amp_active_days DROP CONSTRAINT amp_active_days_surface_check;
ALTER TABLE amp_active_days ADD CONSTRAINT amp_active_days_surface_check
  CHECK(surface IN ('practice','lesson','feedback','map','other','hint','video','example')) NOT VALID;
ALTER TABLE amp_active_days VALIDATE CONSTRAINT amp_active_days_surface_check;

-- Which help an answer had. `assisted` stays the engine's one flag; these say
-- which kinds made it so (and a video or a worked explanation, which do not).
ALTER TABLE amp_skill_days
  ADD COLUMN with_hint integer NOT NULL DEFAULT 0,
  ADD COLUMN with_lesson integer NOT NULL DEFAULT 0,
  ADD COLUMN with_video integer NOT NULL DEFAULT 0,
  ADD COLUMN with_example integer NOT NULL DEFAULT 0,
  ADD COLUMN with_person integer NOT NULL DEFAULT 0;

-- The week holds counts and active time per kind, and answers by the help
-- they had, so a week of help is still one row per learner.
ALTER TABLE amp_learner_weeks
  ADD COLUMN lessons integer NOT NULL DEFAULT 0 CHECK(lessons>=0),
  ADD COLUMN hints integer NOT NULL DEFAULT 0 CHECK(hints>=0),
  ADD COLUMN videos integer NOT NULL DEFAULT 0 CHECK(videos>=0),
  ADD COLUMN examples integer NOT NULL DEFAULT 0 CHECK(examples>=0),
  ADD COLUMN prints integer NOT NULL DEFAULT 0 CHECK(prints>=0),
  ADD COLUMN lesson_ms bigint NOT NULL DEFAULT 0 CHECK(lesson_ms>=0),
  ADD COLUMN hint_ms bigint NOT NULL DEFAULT 0 CHECK(hint_ms>=0),
  ADD COLUMN video_ms bigint NOT NULL DEFAULT 0 CHECK(video_ms>=0),
  ADD COLUMN example_ms bigint NOT NULL DEFAULT 0 CHECK(example_ms>=0),
  ADD COLUMN with_hint integer NOT NULL DEFAULT 0 CHECK(with_hint>=0),
  ADD COLUMN with_lesson integer NOT NULL DEFAULT 0 CHECK(with_lesson>=0),
  ADD COLUMN with_video integer NOT NULL DEFAULT 0 CHECK(with_video>=0),
  ADD COLUMN with_example integer NOT NULL DEFAULT 0 CHECK(with_example>=0),
  ADD COLUMN with_person integer NOT NULL DEFAULT 0 CHECK(with_person>=0);

-- One statement of events, summed once: a heartbeat's batch is one upsert per
-- day row and one per week, not one per event.
CREATE FUNCTION amp_roll_help_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO amp_help_days(learner_id,day,kind,skill_id,opened)
  SELECT learner_id,day,kind,skill_id,count(*)::int FROM fresh GROUP BY 1,2,3,4
  ON CONFLICT(learner_id,day,kind,skill_id) DO UPDATE SET opened=amp_help_days.opened+EXCLUDED.opened;
  IF current_setting('amp.rollup_weeks',true)='deferred' THEN RETURN NULL; END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,lessons,hints,videos,examples,prints)
  SELECT learner_id,date_trunc('week',day)::date,
    count(*) FILTER (WHERE kind='lesson')::int,count(*) FILTER (WHERE kind='hint')::int,
    count(*) FILTER (WHERE kind='video')::int,count(*) FILTER (WHERE kind='example')::int,
    count(*) FILTER (WHERE kind='print')::int
  FROM fresh GROUP BY 1,2
  ON CONFLICT(learner_id,week) DO UPDATE SET
    lessons=amp_learner_weeks.lessons+EXCLUDED.lessons,hints=amp_learner_weeks.hints+EXCLUDED.hints,
    videos=amp_learner_weeks.videos+EXCLUDED.videos,examples=amp_learner_weeks.examples+EXCLUDED.examples,
    prints=amp_learner_weeks.prints+EXCLUDED.prints;
  RETURN NULL;
END $$;
CREATE TRIGGER amp_help_events_roll AFTER INSERT ON amp_help_events
  REFERENCING NEW TABLE AS fresh FOR EACH STATEMENT EXECUTE FUNCTION amp_roll_help_events();

CREATE OR REPLACE FUNCTION amp_add_active_week() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  added bigint := NEW.active_ms;
BEGIN
  IF current_setting('amp.rollup_weeks',true)='deferred' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN added := NEW.active_ms-OLD.active_ms; END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,active_ms,lesson_ms,hint_ms,video_ms,example_ms)
  VALUES(NEW.learner_id,date_trunc('week',NEW.day)::date,GREATEST(added,0),
    CASE WHEN NEW.surface='lesson' THEN GREATEST(added,0) ELSE 0 END,
    CASE WHEN NEW.surface='hint' THEN GREATEST(added,0) ELSE 0 END,
    CASE WHEN NEW.surface='video' THEN GREATEST(added,0) ELSE 0 END,
    CASE WHEN NEW.surface='example' THEN GREATEST(added,0) ELSE 0 END)
  ON CONFLICT(learner_id,week) DO UPDATE SET
    active_ms=GREATEST(amp_learner_weeks.active_ms+added,0),
    lesson_ms=GREATEST(amp_learner_weeks.lesson_ms+CASE WHEN NEW.surface='lesson' THEN added ELSE 0 END,0),
    hint_ms=GREATEST(amp_learner_weeks.hint_ms+CASE WHEN NEW.surface='hint' THEN added ELSE 0 END,0),
    video_ms=GREATEST(amp_learner_weeks.video_ms+CASE WHEN NEW.surface='video' THEN added ELSE 0 END,0),
    example_ms=GREATEST(amp_learner_weeks.example_ms+CASE WHEN NEW.surface='example' THEN added ELSE 0 END,0);
  RETURN NEW;
END $$;

-- An answer's `help` names the kinds it had (src/server/app.ts). An answer
-- stored before it has none, and counts only as assisted.
CREATE OR REPLACE FUNCTION amp_update_skill_days() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  zone text;
  is_correct boolean := COALESCE((NEW.outcome->>'correct')::boolean,false);
  is_assisted boolean := COALESCE((NEW.outcome->>'assisted')::boolean,false);
  help jsonb := CASE WHEN jsonb_typeof(NEW.outcome->'help')='array' THEN NEW.outcome->'help' ELSE '[]'::jsonb END;
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

CREATE OR REPLACE FUNCTION amp_add_attempts_week() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  added integer := NEW.attempts;
  helped integer := NEW.assisted;
  hint integer := NEW.with_hint;
  lesson integer := NEW.with_lesson;
  video integer := NEW.with_video;
  example integer := NEW.with_example;
  person integer := NEW.with_person;
BEGIN
  IF current_setting('amp.rollup_weeks',true)='deferred' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    added := NEW.attempts-OLD.attempts;
    helped := NEW.assisted-OLD.assisted;
    hint := NEW.with_hint-OLD.with_hint;
    lesson := NEW.with_lesson-OLD.with_lesson;
    video := NEW.with_video-OLD.with_video;
    example := NEW.with_example-OLD.with_example;
    person := NEW.with_person-OLD.with_person;
  END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,attempts,assisted,with_hint,with_lesson,with_video,with_example,with_person)
  VALUES(NEW.learner_id,date_trunc('week',NEW.day)::date,GREATEST(added,0),GREATEST(helped,0),
    GREATEST(hint,0),GREATEST(lesson,0),GREATEST(video,0),GREATEST(example,0),GREATEST(person,0))
  ON CONFLICT(learner_id,week) DO UPDATE SET
    attempts=GREATEST(amp_learner_weeks.attempts+added,0),
    assisted=GREATEST(amp_learner_weeks.assisted+helped,0),
    with_hint=GREATEST(amp_learner_weeks.with_hint+hint,0),
    with_lesson=GREATEST(amp_learner_weeks.with_lesson+lesson,0),
    with_video=GREATEST(amp_learner_weeks.with_video+video,0),
    with_example=GREATEST(amp_learner_weeks.with_example+example,0),
    with_person=GREATEST(amp_learner_weeks.with_person+person,0);
  RETURN NEW;
END $$;

-- Lesson time recorded before this migration already sits in its weeks.
UPDATE amp_learner_weeks w SET lesson_ms=a.ms
FROM (
  SELECT learner_id,date_trunc('week',day)::date AS week,sum(active_ms)::bigint AS ms
  FROM amp_active_days WHERE surface='lesson' GROUP BY 1,2
) a
WHERE a.learner_id=w.learner_id AND a.week=w.week AND a.ms>0;
