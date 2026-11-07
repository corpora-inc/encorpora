-- Each learner's level estimate, so a request folds in only the answers since
-- it was stored instead of every answer the learner has ever given. Derived
-- from amp_attempts and rebuilt whenever it is missing or out of date.
CREATE TABLE amp_frontier_states (
  learner_id text PRIMARY KEY REFERENCES amp_learners(id) ON DELETE CASCADE,
  state text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Choosing problems reads a learner's skips from the last few hours. Without
-- this it reads every problem the learner has ever seen.
CREATE INDEX amp_instances_skipped_idx ON amp_instances(learner_id,created_at DESC)
  WHERE (content->>'skipped')::boolean;
