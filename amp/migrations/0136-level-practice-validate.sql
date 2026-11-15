-- Validates 0135's check in its own transaction. VALIDATE CONSTRAINT holds a
-- SHARE UPDATE EXCLUSIVE lock, so learner reads and writes continue while it
-- scans the table.
ALTER TABLE amp_learners
  VALIDATE CONSTRAINT amp_learners_level_practice_simulation;
