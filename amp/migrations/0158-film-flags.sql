-- Viewer reports on a lesson film at a moment of it ("Report this film").
-- First-party only; never sent to a third party. The film's id comes from the
-- server's manifest for the problem type; the client supplies the edition it
-- played (`film_version`), the moment, the player layout, reasons, an
-- optional note, the problem it was opened for, and its own build details.
--
-- Who: `viewer` is what the server decided from the credential. A learner's
-- own session (a school or family student) or a trial links `learner_id`, as
-- "Report a problem" does (amp_problem_flags); an adult's account links
-- `account_id`; a visitor who is not signed in links neither.
--
-- Privacy: a note (280 characters) is accepted only where `noteAllowed`
-- allows a learner free text (COPPA, 16 CFR 312.2: free text from a child
-- under 13 is personal information) and from adults; never from a trial or a
-- visitor who is not signed in. Deleting the learner's learning data, or the
-- adult's account, unlinks the row and erases its note; what remains is a
-- report about a film. RETENTION.problemFlagNoteDays erases notes and
-- RETENTION.problemFlagDays deletes rows, as for problem reports
-- (src/privacy/retention-periods.ts, src/feedback/retention.ts).
CREATE TABLE amp_film_flags (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  film_id text NOT NULL CHECK (char_length(film_id) BETWEEN 1 AND 160),
  film_version text NOT NULL CHECK (film_version ~ '^[a-f0-9]{64}$'),
  template_id text NOT NULL CHECK (char_length(template_id) BETWEEN 1 AND 100),
  problem_id text CHECK (char_length(problem_id) BETWEEN 1 AND 160),
  seconds numeric(7,1) NOT NULL CHECK (seconds >= 0 AND seconds <= 36000),
  layout text NOT NULL CHECK (layout IN ('wide','tall')),
  reasons text[] NOT NULL CHECK (
    cardinality(reasons) BETWEEN 1 AND 5
    AND reasons <@ ARRAY['picture-wrong','voice-wrong','too-fast','confusing','other']::text[]
  ),
  note text CHECK (char_length(note) BETWEEN 1 AND 280),
  viewer text NOT NULL CHECK (viewer IN ('learner','trial','adult','signed-out')),
  learner_id text REFERENCES amp_learners(id) ON DELETE SET NULL,
  account_id text CHECK (char_length(account_id) BETWEEN 1 AND 200),
  web_commit text CHECK (web_commit ~ '^[0-9a-f]{40}$'),
  api_commit text CHECK (api_commit ~ '^[0-9a-f]{40}$'),
  client_kind text NOT NULL CHECK (client_kind IN ('web','ios','android','native')),
  viewport_width integer NOT NULL CHECK (viewport_width BETWEEN 1 AND 20000),
  viewport_height integer NOT NULL CHECK (viewport_height BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- An adult's account is the only account a report names.
  CHECK (account_id IS NULL OR viewer = 'adult'),
  CHECK (learner_id IS NULL OR viewer IN ('learner','trial')),
  -- A note exists only while the row is linked to the person who wrote it.
  CHECK (note IS NULL OR learner_id IS NOT NULL OR account_id IS NOT NULL)
);
-- Retries return the saved report. A viewer may report one film many times.
CREATE UNIQUE INDEX amp_film_flags_request_idx ON amp_film_flags(request_id);
CREATE INDEX amp_film_flags_time_idx ON amp_film_flags(created_at);
CREATE INDEX amp_film_flags_film_idx ON amp_film_flags(film_id, created_at);
CREATE INDEX amp_film_flags_learner_idx ON amp_film_flags(learner_id) WHERE learner_id IS NOT NULL;
CREATE INDEX amp_film_flags_account_idx ON amp_film_flags(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX amp_film_flags_note_idx ON amp_film_flags(created_at) WHERE note IS NOT NULL;
-- The learner foreign key's SET NULL erases the note in the same statement,
-- as does clearing the account.
CREATE FUNCTION amp_film_flag_unlinked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.learner_id IS NULL AND NEW.account_id IS NULL THEN NEW.note := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_film_flags_unlink BEFORE UPDATE ON amp_film_flags
  FOR EACH ROW EXECUTE FUNCTION amp_film_flag_unlinked();
