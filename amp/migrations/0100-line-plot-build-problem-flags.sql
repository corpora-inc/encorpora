-- Extend the installed constraint so independently shipped response formats survive.
DO $$
DECLARE existing text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO existing
  FROM pg_constraint
  WHERE conrelid = 'amp_problem_flags'::regclass
    AND conname = 'amp_problem_flags_response_kind_check';
  ALTER TABLE amp_problem_flags DROP CONSTRAINT amp_problem_flags_response_kind_check;
  EXECUTE 'ALTER TABLE amp_problem_flags ADD CONSTRAINT amp_problem_flags_response_kind_check CHECK (('
    || substring(existing FROM 7 FOR char_length(existing) - 6)
    || ') OR response_kind = ''line-plot-build'')';
END $$;
