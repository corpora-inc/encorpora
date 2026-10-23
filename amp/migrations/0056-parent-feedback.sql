-- Adult-volunteered product feedback, deliberately unlinked from learner,
-- account, payment and advertising records. Never expose a public read route.
CREATE TABLE amp_parent_feedback (
  request_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  context text NOT NULL CHECK (context IN ('general','plans','invoice','purchase')),
  program text CHECK (program IN ('ar-efa','az-esa')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000)
);
CREATE INDEX amp_parent_feedback_created_at ON amp_parent_feedback(created_at);
