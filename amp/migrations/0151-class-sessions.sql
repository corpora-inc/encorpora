-- Live class sessions (#2465, #2464). A teacher or a family's parent starts a
-- session for a class; while it runs, the adult's screen reads each student's
-- work inside the session's window from the evidence that already exists
-- (amp_attempts, amp_help_events): nothing here is a second copy of an answer.
-- Stopping freezes one row per student, so the report stays the same after
-- later answers. Design: src/schools/live/.

CREATE TABLE amp_class_sessions (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES amp_classes(id) ON DELETE CASCADE,
  started_by uuid REFERENCES amp_people(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  -- "AMP from 1:15 to 1:30". Absent: the four-hour limit ends it.
  planned_end_at timestamptz,
  ended_at timestamptz,
  ended_by uuid REFERENCES amp_people(id) ON DELETE SET NULL,
  -- stopped: an adult pressed Stop. planned_end / time_limit: a reader closed
  -- it after its planned end or four hours (ended_at is that moment).
  end_reason text CHECK(end_reason IN ('stopped','planned_end','time_limit')),
  -- The status rules (src/schools/live/status.ts) its report was judged by.
  rules_version smallint NOT NULL CHECK(rules_version>0),
  CHECK((ended_at IS NULL)=(end_reason IS NULL)),
  CHECK(planned_end_at IS NULL OR planned_end_at>started_at),
  CHECK(ended_at IS NULL OR ended_at>=started_at)
);
-- One open session per class: a second Start finds the first.
CREATE UNIQUE INDEX amp_class_sessions_open_idx ON amp_class_sessions(class_id) WHERE ended_at IS NULL;
CREATE INDEX amp_class_sessions_class_idx ON amp_class_sessions(class_id,started_at DESC);

-- The report: one row per student on the roster when it stopped, including
-- the ones who never answered. Rows, not a document, so deleting a learner
-- takes theirs (cascade) and an export can name them.
CREATE TABLE amp_class_session_students (
  session_id uuid NOT NULL REFERENCES amp_class_sessions(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES amp_people(id) ON DELETE CASCADE,
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  problems integer NOT NULL CHECK(problems>=0),
  correct integer NOT NULL CHECK(correct>=0),
  independent integer NOT NULL CHECK(independent>=0),
  assisted integer NOT NULL CHECK(assisted>=0),
  hints integer NOT NULL CHECK(hints>=0),
  lessons integer NOT NULL CHECK(lessons>=0),
  examples integer NOT NULL CHECK(examples>=0),
  videos integer NOT NULL CHECK(videos>=0),
  -- Skills answered in the session, first answered first; the last answer's.
  skills text[] NOT NULL DEFAULT '{}',
  skill_id text,
  -- The overall level estimate stored when it stopped (amp_level_days).
  level real,
  first_seen_at timestamptz,
  first_answer_at timestamptz,
  last_answer_at timestamptz,
  status text NOT NULL CHECK(status IN ('not_signed_in','idle','struggling','flying','working')),
  PRIMARY KEY(session_id,person_id)
);
CREATE INDEX amp_class_session_students_learner_idx ON amp_class_session_students(learner_id);
CREATE INDEX amp_class_session_students_person_idx ON amp_class_session_students(person_id);

-- A student asking for the adult: a raised hand, or "I forgot my picture" from
-- the sign-in screen. Class-scoped, so it works with no session running.
CREATE TABLE amp_class_signals (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES amp_classes(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES amp_people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('hand','forgot_picture')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES amp_people(id) ON DELETE SET NULL,
  resolution text CHECK(resolution IN ('acknowledged','reset','withdrawn','expired')),
  CHECK((resolved_at IS NULL)=(resolution IS NULL))
);
-- One open request of a kind per student per class.
CREATE UNIQUE INDEX amp_class_signals_open_idx ON amp_class_signals(class_id,person_id,kind) WHERE resolved_at IS NULL;
CREATE INDEX amp_class_signals_person_idx ON amp_class_signals(person_id);
CREATE INDEX amp_class_signals_at_idx ON amp_class_signals USING brin(created_at);

-- A short-lived outbox: "something about this person in this class changed".
-- It carries no content (the live read recomputes rows from the evidence), so
-- it has no foreign keys to slow the answer that writes it; a class's go with
-- the class. Pruned daily (RETENTION.classEventHours).
CREATE TABLE amp_class_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES amp_classes(id) ON DELETE CASCADE,
  -- The open session it was written under; null for a signal with none.
  session_id uuid,
  -- Null for an event about the class itself (a session started or stopped).
  person_id uuid,
  kind text NOT NULL CHECK(kind IN ('answer','help','presence','session','signal')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- The stream's tail: a class's recent events.
CREATE INDEX amp_class_events_class_idx ON amp_class_events(class_id,created_at);
-- When a student first showed up in a session.
CREATE INDEX amp_class_events_presence_idx ON amp_class_events(session_id,person_id,created_at) WHERE kind='presence';
CREATE INDEX amp_class_events_at_idx ON amp_class_events USING brin(created_at);
