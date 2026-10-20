-- Learner reports on a resolved problem ("Report a problem"). First-party
-- only; never sent to a third party. The problem's identity and rendered
-- payload (template, version, seed, prompt, figure kind) come from the
-- server's stored instance, and the answer and outcome from its attempt, so a
-- client can only choose the reasons, the note and its own build details.
--
-- Privacy: a row is linked to its learner (and so the household) the way
-- attempts are. Deleting the learner's learning data, by a parent or by
-- retention, unlinks the row and erases its note; what remains is a report
-- about generated content. RETENTION.problemFlagNoteDays erases notes and
-- RETENTION.problemFlagDays deletes rows (src/privacy/retention-periods.ts).
CREATE TABLE amp_problem_flags (
  id uuid PRIMARY KEY,
  learner_id text REFERENCES amp_learners(id) ON DELETE SET NULL,
  request_id uuid NOT NULL,
  problem_id text NOT NULL CHECK (char_length(problem_id) BETWEEN 1 AND 160),
  template_id text NOT NULL CHECK (char_length(template_id) BETWEEN 1 AND 100),
  template_version integer NOT NULL,
  seed text NOT NULL CHECK (char_length(seed) BETWEEN 1 AND 128),
  skill_id text NOT NULL CHECK (char_length(skill_id) BETWEEN 1 AND 100),
  prompt text NOT NULL CHECK (char_length(prompt) <= 4000),
  figure_kind text CHECK (char_length(figure_kind) <= 64),
  response_kind text NOT NULL CHECK (response_kind IN ('number','fraction','choice')),
  response text CHECK (char_length(response) <= 200),
  outcome text NOT NULL CHECK (outcome IN ('correct','incorrect','skipped')),
  assisted boolean NOT NULL DEFAULT false,
  reasons text[] NOT NULL CHECK (
    cardinality(reasons) BETWEEN 1 AND 5
    AND reasons <@ ARRAY['wrong-answer','confusing-wording','figure-wrong','tedious','other']::text[]
  ),
  note text CHECK (char_length(note) BETWEEN 1 AND 280),
  web_commit text CHECK (web_commit ~ '^[0-9a-f]{40}$'),
  api_commit text CHECK (api_commit ~ '^[0-9a-f]{40}$'),
  client_kind text NOT NULL CHECK (client_kind IN ('web','ios','android','native')),
  viewport_width integer NOT NULL CHECK (viewport_width BETWEEN 1 AND 20000),
  viewport_height integer NOT NULL CHECK (viewport_height BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A note exists only while the row is linked to a learner.
  CHECK (note IS NULL OR learner_id IS NOT NULL)
);
-- Retries return the saved report; a problem is reported once per learner.
CREATE UNIQUE INDEX amp_problem_flags_request_idx ON amp_problem_flags(learner_id, request_id);
CREATE UNIQUE INDEX amp_problem_flags_problem_idx ON amp_problem_flags(learner_id, problem_id);
CREATE INDEX amp_problem_flags_time_idx ON amp_problem_flags(created_at);
CREATE INDEX amp_problem_flags_template_idx ON amp_problem_flags(template_id);
CREATE INDEX amp_problem_flags_note_idx ON amp_problem_flags(created_at) WHERE note IS NOT NULL;
-- The learner foreign key's SET NULL erases the note in the same statement.
CREATE FUNCTION amp_problem_flag_unlinked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.learner_id IS NULL THEN NEW.note := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_problem_flags_unlink BEFORE UPDATE ON amp_problem_flags
  FOR EACH ROW EXECUTE FUNCTION amp_problem_flag_unlinked();
