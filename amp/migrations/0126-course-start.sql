-- A course supplies an initial estimate, never an invented birthday or evidence.
-- Freeze the first course-derived start so moving classes cannot replay the
-- learner's history from a different prior.
ALTER TABLE amp_learners ADD COLUMN starting_course_level double precision
  CHECK (starting_course_level BETWEEN 0 AND 13);

-- Preserve the implicit prior of children who already answered before this
-- column existed. Course placement applies to a first start, not a replay
-- of established evidence from a different prior.
UPDATE amp_learners l SET starting_course_level=2
WHERE NOT l.adult AND l.birth_year IS NULL AND l.starting_band IS NULL
  AND EXISTS(SELECT 1 FROM amp_attempts a WHERE a.learner_id=l.id);
