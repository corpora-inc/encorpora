-- Preserve every response kind already accepted, including independently
-- deployed formats, when adding learner reports for counter builds.
DO $migration$
DECLARE existing_expression text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT existing_expression
    FROM pg_constraint
    WHERE conrelid = 'amp_problem_flags'::regclass
      AND conname = 'amp_problem_flags_response_kind_check';
  ALTER TABLE amp_problem_flags DROP CONSTRAINT amp_problem_flags_response_kind_check;
  EXECUTE format('ALTER TABLE amp_problem_flags ADD CONSTRAINT amp_problem_flags_response_kind_check CHECK ((%s) OR response_kind = %L)',
    existing_expression, 'counter-builder');
END;
$migration$;
