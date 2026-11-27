-- Who takes part in an AMP research study (docs/research-export.md). One row
-- per study and learner. The consent flow writes it through
-- src/research/participants.ts: enrolment when research permission is given,
-- withdrawal when it is taken back. The export job reads it and nothing else
-- decides who is in an extract: a withdrawn learner is never exported.
--
-- `account_id` is the household the learner belongs to, so siblings share a
-- family study ID. `consent_ref` points at the permission record the consent
-- flow keeps (null until that flow exists). Rows go with the learner by
-- cascade, like the learner's other records.
CREATE TABLE amp_research_participants (
  study text NOT NULL CHECK (study ~ '^[a-z][a-z0-9-]{1,31}$'),
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz CHECK (withdrawn_at IS NULL OR withdrawn_at >= enrolled_at),
  consent_ref text CHECK (consent_ref IS NULL OR length(consent_ref) BETWEEN 1 AND 200),
  PRIMARY KEY (study, learner_id)
);
CREATE INDEX amp_research_participants_learner_idx ON amp_research_participants(learner_id);
