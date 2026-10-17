CREATE TABLE amp_parent_consents (
 account_id text PRIMARY KEY,
 policy_version text NOT NULL,
 verification_method text NOT NULL,
 evidence_reference text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 withdrawn_at timestamptz
);
CREATE INDEX amp_attempts_recent_idx ON amp_attempts(learner_id,created_at DESC,id DESC);
