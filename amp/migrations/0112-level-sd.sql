-- Growth reads every settled level day of every student in the window
-- (src/schools/growth.ts): its level and its reported sd. The sd sat inside
-- the frontier, so a district Overview opened 10,000 frontiers to read it
-- (7.8 s). Beside the level on the index, the fit reads the index alone.
ALTER TABLE amp_level_days
  ADD COLUMN overall_sd double precision GENERATED ALWAYS AS ((frontier->'overall'->>'sd')::double precision) STORED;
CREATE INDEX amp_level_days_growth_idx ON amp_level_days(learner_id,day) INCLUDE (overall_level,overall_answered,overall_sd);
DROP INDEX amp_level_days_placed_idx;
