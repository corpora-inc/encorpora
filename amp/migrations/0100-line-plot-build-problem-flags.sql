-- Keep learner reports for constructed line plots.
ALTER TABLE amp_problem_flags DROP CONSTRAINT amp_problem_flags_response_kind_check;
ALTER TABLE amp_problem_flags ADD CONSTRAINT amp_problem_flags_response_kind_check
  CHECK (response_kind IN ('number', 'fraction', 'choice', 'multi-select',
    'point-plot', 'multi-part-choice', 'figure-choice', 'structured-work', 'line-plot-build'));
