-- Two doses a study counts that AMP did not record (docs/engagement-measurement.md,
-- "Learning measurement").

-- A video's playback. `video` already records a video opened, and its active
-- time is the `video` surface's. These say it was played, and played to its
-- end, once per opening. They ride on the heartbeat as every help event does
-- and roll into the day and the week beside it.
ALTER TYPE amp_help_kind ADD VALUE IF NOT EXISTS 'video_play';
ALTER TYPE amp_help_kind ADD VALUE IF NOT EXISTS 'video_complete';
ALTER TABLE amp_learner_weeks
  ADD COLUMN video_plays integer NOT NULL DEFAULT 0 CHECK(video_plays>=0),
  ADD COLUMN video_completes integer NOT NULL DEFAULT 0 CHECK(video_completes>=0);
-- The kinds are compared as text: a value added above can't be used as the
-- enum until this transaction commits.
CREATE OR REPLACE FUNCTION amp_roll_help_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO amp_help_days(learner_id,day,kind,skill_id,opened)
  SELECT learner_id,day,kind,skill_id,count(*)::int FROM fresh GROUP BY 1,2,3,4
  ON CONFLICT(learner_id,day,kind,skill_id) DO UPDATE SET opened=amp_help_days.opened+EXCLUDED.opened;
  IF current_setting('amp.rollup_weeks',true)='deferred' THEN RETURN NULL; END IF;
  INSERT INTO amp_learner_weeks(learner_id,week,lessons,hints,videos,examples,prints,video_plays,video_completes)
  SELECT learner_id,date_trunc('week',day)::date,
    count(*) FILTER (WHERE kind::text='lesson')::int,count(*) FILTER (WHERE kind::text='hint')::int,
    count(*) FILTER (WHERE kind::text='video')::int,count(*) FILTER (WHERE kind::text='example')::int,
    count(*) FILTER (WHERE kind::text='print')::int,count(*) FILTER (WHERE kind::text='video_play')::int,
    count(*) FILTER (WHERE kind::text='video_complete')::int
  FROM fresh GROUP BY 1,2
  ON CONFLICT(learner_id,week) DO UPDATE SET
    lessons=amp_learner_weeks.lessons+EXCLUDED.lessons,hints=amp_learner_weeks.hints+EXCLUDED.hints,
    videos=amp_learner_weeks.videos+EXCLUDED.videos,examples=amp_learner_weeks.examples+EXCLUDED.examples,
    prints=amp_learner_weeks.prints+EXCLUDED.prints,
    video_plays=amp_learner_weeks.video_plays+EXCLUDED.video_plays,
    video_completes=amp_learner_weeks.video_completes+EXCLUDED.video_completes;
  RETURN NULL;
END $$;

-- An adult checking in on a learner: a parent or a teacher reading their
-- record, assigning them work, or scoring their workbook. A row says which
-- role, which learner, what and when, and nothing more: not who the adult
-- is, not what they read. It goes with the learner's other records.
CREATE TYPE amp_checkin_role AS ENUM ('parent','teacher','aide','school_staff');
CREATE TYPE amp_checkin_kind AS ENUM ('view','assign','score');
CREATE TABLE amp_adult_checkins (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  "at" timestamptz NOT NULL DEFAULT now(),
  role amp_checkin_role NOT NULL,
  kind amp_checkin_kind NOT NULL
);
CREATE INDEX amp_adult_checkins_learner_idx ON amp_adult_checkins(learner_id,"at");

-- Whose sign-in made a practice change: a student's own session, or an
-- account's. An account's sign-in on a family device is the parent's and the
-- child's alike, so `account` can't say which; older rows are null.
ALTER TABLE amp_practice_changes
  ADD COLUMN made_in text CHECK (made_in IN ('student','account'));
