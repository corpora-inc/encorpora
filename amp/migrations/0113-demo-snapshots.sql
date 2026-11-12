-- A demo place's term is the production planner and estimator over every
-- simulated answer: minutes of CPU for a school. It depends only on the day,
-- the zone and the generator (src/schools/demo/snapshot.ts), so one pod
-- computes it ahead of time and every demo made that day writes it. A pod
-- claims a key by setting `building_until`; the others wait for `payload`.
-- Nothing here names a person: the roster is made up and ids are added when
-- a demo is written.
CREATE TABLE amp_demo_snapshots (
  key text PRIMARY KEY,
  payload bytea,
  building_until timestamptz,
  built_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_demo_snapshots_created_idx ON amp_demo_snapshots(created_at);

-- A bulk writer of fresh learners' answers (src/schools/demo/history.ts) sets
-- `amp.bulk_answers` to 'deferred': it takes each learner's lock once,
-- numbers their answers itself in order, and writes their skill days and
-- skill evidence once, from the whole set. A deferred week rollup
-- (`amp.rollup_weeks`) is summed once by its writer. The conditions are on
-- the triggers, so a deferred row queues nothing; every other write is as
-- before.
DROP TRIGGER amp_attempt_evidence_order ON amp_attempts;
CREATE TRIGGER amp_attempt_evidence_order BEFORE INSERT ON amp_attempts FOR EACH ROW
  WHEN (current_setting('amp.bulk_answers', true) IS DISTINCT FROM 'deferred')
  EXECUTE FUNCTION amp_order_skill_observation();
DROP TRIGGER amp_attempt_skill_days ON amp_attempts;
CREATE TRIGGER amp_attempt_skill_days AFTER INSERT ON amp_attempts FOR EACH ROW
  WHEN (current_setting('amp.bulk_answers', true) IS DISTINCT FROM 'deferred')
  EXECUTE FUNCTION amp_update_skill_days();
DROP TRIGGER amp_attempt_skill_evidence ON amp_attempts;
CREATE TRIGGER amp_attempt_skill_evidence AFTER INSERT ON amp_attempts FOR EACH ROW
  WHEN (current_setting('amp.bulk_answers', true) IS DISTINCT FROM 'deferred')
  EXECUTE FUNCTION amp_update_skill_evidence();
DROP TRIGGER amp_skill_days_week ON amp_skill_days;
CREATE TRIGGER amp_skill_days_week AFTER INSERT OR UPDATE OF attempts ON amp_skill_days FOR EACH ROW
  WHEN (current_setting('amp.rollup_weeks', true) IS DISTINCT FROM 'deferred')
  EXECUTE FUNCTION amp_add_attempts_week();
DROP TRIGGER amp_active_days_week ON amp_active_days;
CREATE TRIGGER amp_active_days_week AFTER INSERT OR UPDATE OF active_ms ON amp_active_days FOR EACH ROW
  WHEN (current_setting('amp.rollup_weeks', true) IS DISTINCT FROM 'deferred')
  EXECUTE FUNCTION amp_add_active_week();
