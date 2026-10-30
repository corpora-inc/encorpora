-- Difficulty recalibration never deletes attempts, earned XP, or skill evidence.
CREATE TABLE amp_practice_settings (
  learner_id text PRIMARY KEY REFERENCES amp_learners(id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE amp_practice_changes (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  change jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, request_id)
);
