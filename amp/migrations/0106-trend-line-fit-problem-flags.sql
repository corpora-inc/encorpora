-- Extend the existing constraint so independently deployed answer formats
-- keep their report support regardless of migration order.
DO $migration$
DECLARE existing_expression text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT existing_expression
    FROM pg_constraint
    WHERE conrelid = 'amp_problem_flags'::regclass
      AND conname = 'amp_problem_flags_response_kind_check';
  ALTER TABLE amp_problem_flags DROP CONSTRAINT amp_problem_flags_response_kind_check;
  EXECUTE format('ALTER TABLE amp_problem_flags ADD CONSTRAINT amp_problem_flags_response_kind_check CHECK ((%s) OR response_kind = %L)',
    existing_expression, 'trend-line-fit');
END;
$migration$;
