-- Clever LMS Connect: AMP assignments published to a district LMS (Google
-- Classroom, Canvas, Schoology) through Clever, and the grades AMP returns.
-- API handlers only write these rows; the LMS worker makes every Clever call.

-- What Clever last said about a district's LMS link, and the worker's backoff.
-- A 401/403 is a capability failure recorded here, never an empty result.
CREATE TABLE amp_clever_lms (
 connection_id uuid PRIMARY KEY REFERENCES amp_clever_connections(id) ON DELETE CASCADE,
 lms_state text,
 lms_type text CHECK(lms_type IN ('canvas','schoology','google_classroom')),
 checked_at timestamptz,
 failure_code text,
 failure_count int NOT NULL DEFAULT 0 CHECK(failure_count>=0),
 next_attempt_at timestamptz
);

-- One gradebook column in one Clever section. `version` counts the teacher's
-- edits; `lms_version` is the last one the LMS has. Clever offers no way to
-- list assignments, so `clever_assignment_id` is stored the moment it exists.
CREATE TABLE amp_lms_assignments (
 id uuid PRIMARY KEY,
 class_id uuid NOT NULL REFERENCES amp_classes(id) ON DELETE CASCADE,
 connection_id uuid NOT NULL REFERENCES amp_clever_connections(id) ON DELETE CASCADE,
 section_id text NOT NULL CHECK(section_id ~ '^[a-f0-9]{24}$'),
 kind text NOT NULL CHECK(kind IN ('practice','term_grade')),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 120),
 points_possible numeric NOT NULL CHECK(points_possible>0 AND points_possible<=1000),
 -- A practice goal: measured minutes from opens_on to due_on, inclusive.
 target_minutes int CHECK(target_minutes BETWEEN 1 AND 6000),
 opens_on date,
 -- The school day it is due; due_at is the end of that day in the school's zone.
 due_on date NOT NULL,
 -- A term grade: the teacher's numeric finals for one grading term.
 session_id uuid REFERENCES amp_academic_sessions(id) ON DELETE CASCADE,
 due_at timestamptz NOT NULL,
 created_by uuid REFERENCES amp_people(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version int NOT NULL DEFAULT 1 CHECK(version>=1),
 -- pending: to create. creating: a create is in flight. unknown: a create got
 -- no answer and may exist; a person decides. published: in the LMS.
 -- deleting: removed in AMP, to delete in the LMS. deleted. missing: deleted
 -- in the LMS by someone else.
 status text NOT NULL DEFAULT 'pending'
   CHECK(status IN ('pending','creating','unknown','published','deleting','deleted','missing')),
 lms_type text CHECK(lms_type IN ('canvas','schoology','google_classroom')),
 clever_assignment_id text UNIQUE CHECK(clever_assignment_id ~ '^[A-Za-z0-9-]{1,100}$'),
 lms_version int NOT NULL DEFAULT 0,
 lms_state text,
 create_started_at timestamptz,
 failure_code text,
 failure_count int NOT NULL DEFAULT 0 CHECK(failure_count>=0),
 next_attempt_at timestamptz,
 sync_requested_at timestamptz,
 last_passback_at timestamptz,
 finalized_at timestamptz,
 deleted_at timestamptz,
 CHECK((kind='practice') = (target_minutes IS NOT NULL AND opens_on IS NOT NULL)),
 CHECK(kind<>'practice' OR due_on>=opens_on),
 CHECK((kind='term_grade') = (session_id IS NOT NULL)),
 CHECK(status NOT IN ('published','deleting','missing') OR clever_assignment_id IS NOT NULL)
);
CREATE INDEX amp_lms_assignments_class_idx ON amp_lms_assignments(class_id,created_at DESC);
CREATE INDEX amp_lms_assignments_work_idx ON amp_lms_assignments(connection_id,next_attempt_at)
 WHERE status NOT IN ('deleted','missing');
-- One live term-grade column per class and term.
CREATE UNIQUE INDEX amp_lms_assignments_term_idx ON amp_lms_assignments(class_id,session_id)
 WHERE kind='term_grade' AND status NOT IN ('deleting','deleted','missing');

-- One student's submission as AMP last wrote or read it. `user_id` is the
-- Clever user ID the submission is addressed by.
CREATE TABLE amp_lms_submissions (
 assignment_id uuid NOT NULL REFERENCES amp_lms_assignments(id) ON DELETE CASCADE,
 user_id text NOT NULL CHECK(user_id ~ '^[a-f0-9]{24}$'),
 person_id uuid REFERENCES amp_people(id) ON DELETE CASCADE,
 lms_state text,
 sent_points numeric,
 sent_final boolean NOT NULL DEFAULT false,
 -- AMP itself turned the work in (only then may AMP reclaim it).
 turned_in boolean NOT NULL DEFAULT false,
 sent_at timestamptz,
 failure_code text,
 failure_count int NOT NULL DEFAULT 0 CHECK(failure_count>=0),
 next_attempt_at timestamptz,
 PRIMARY KEY(assignment_id,user_id)
);
CREATE INDEX amp_lms_submissions_person_idx ON amp_lms_submissions(person_id);

-- A deleted or tombstoned person's passback record goes with them. Grades
-- already in the district's LMS are the district's record.
CREATE FUNCTION amp_lms_forget_person() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM amp_lms_submissions WHERE person_id=OLD.id;
 RETURN NULL;
END;
$$;
CREATE TRIGGER amp_lms_person_tombstoned AFTER UPDATE ON amp_people
 FOR EACH ROW WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at AND NEW.deleted_at IS NOT NULL)
 EXECUTE FUNCTION amp_lms_forget_person();
