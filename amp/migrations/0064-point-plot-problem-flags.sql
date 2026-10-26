-- Retain learner reports for the online point-plot response format.
ALTER TABLE amp_problem_flags
  DROP CONSTRAINT amp_problem_flags_response_kind_check;
ALTER TABLE amp_problem_flags
  ADD CONSTRAINT amp_problem_flags_response_kind_check
  CHECK (
    response_kind IN ('number', 'fraction', 'choice', 'multi-select', 'point-plot')
  );
