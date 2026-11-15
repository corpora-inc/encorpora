-- Practice at a level (docs/families.md): one reusable practice profile per
-- account, unnamed, for an adult who helps someone ("my niece, 4th grade")
-- or simply wants a level. `level_practice` holds the grade and pace last
-- chosen ({"grade": 4, "pace": "on-level"}); it marks the account's one level
-- profile, which every new choice starts again. It never holds anything
-- about anyone else.
ALTER TABLE amp_learners
  ADD COLUMN level_practice jsonb,
  ADD CONSTRAINT amp_learners_level_practice_simulation
    CHECK (level_practice IS NULL OR simulation);

CREATE UNIQUE INDEX amp_learners_one_level_practice_idx ON amp_learners(account_id)
  WHERE level_practice IS NOT NULL AND deleted_at IS NULL;
