-- Practice at a level (docs/families.md): one reusable practice profile per
-- account, unnamed, for an adult who helps someone ("my niece, 4th grade")
-- or simply wants a level. `level_practice` holds the grade and pace last
-- chosen ({"grade": 4, "pace": "on-level"}); it marks the account's one level
-- profile, which every new choice starts again. It never holds anything
-- about anyone else.
-- A nullable column without a default and a NOT VALID check only change the
-- catalog: the exclusive lock lasts no longer than that. 0136 validates the
-- check and 0137 builds the one-per-account index without blocking writes.
ALTER TABLE amp_learners
  ADD COLUMN level_practice jsonb,
  ADD CONSTRAINT amp_learners_level_practice_simulation
    CHECK (level_practice IS NULL OR simulation) NOT VALID;
