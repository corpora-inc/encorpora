-- Anonymous "try free" placement. A trial learner lives under the synthetic
-- account 'trial:<id>' and holds no name or contact data; only a hash of the
-- device's trial token is stored. Unadopted trials are deleted on expiry.
CREATE TABLE amp_trials (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  learner_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  adopted_at timestamptz,
  adopted_by text,
  CHECK ((adopted_at IS NULL) = (adopted_by IS NULL))
);
CREATE INDEX amp_trials_expiry_idx ON amp_trials(expires_at) WHERE adopted_at IS NULL;
