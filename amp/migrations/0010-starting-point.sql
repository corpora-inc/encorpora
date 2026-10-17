ALTER TABLE amp_learners
  ADD COLUMN starting_band text,
  ADD COLUMN starting_policy integer,
  ADD COLUMN starting_excluded_strands text[],
  ADD CONSTRAINT amp_starting_point_valid CHECK (
    (starting_band IS NULL AND starting_policy IS NULL AND starting_excluded_strands IS NULL)
    OR (starting_band IN ('K–2','3–5','6–8','9–12') AND starting_policy = 1
      AND starting_band IS NOT NULL AND starting_policy IS NOT NULL
      AND starting_excluded_strands IS NOT NULL
      AND cardinality(starting_excluded_strands) <= 64
      AND array_position(starting_excluded_strands,NULL) IS NULL)
  );
