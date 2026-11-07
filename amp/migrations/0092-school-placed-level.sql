-- A term's growth starts where placement settled: the first stored level of the
-- term from an estimate past placement (src/schools/start-level.ts). How many
-- answers an estimate stands on sits beside its level, so the overview still
-- reads both straight off the index for a whole district.
ALTER TABLE amp_level_days
  ADD COLUMN overall_answered integer GENERATED ALWAYS AS ((frontier->'overall'->>'answered')::integer) STORED;
CREATE INDEX amp_level_days_placed_idx ON amp_level_days(learner_id,day) INCLUDE (overall_level,overall_answered);
DROP INDEX amp_level_days_overall_idx;
