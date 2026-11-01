-- Daily paper workbooks (src/workbook). The spec names every problem by
-- template, version and seed, so a stored workbook reprints exactly. One
-- workbook per learner, date, number and length; "another one" is the next
-- number. Rows are learning data: they cascade with the learner and are
-- deleted with the learner's learning data (src/family/repository.ts).
CREATE TABLE amp_workbooks (
  id uuid PRIMARY KEY,
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  workbook_date date NOT NULL,
  number integer NOT NULL CHECK (number BETWEEN 1 AND 999),
  minutes integer NOT NULL CHECK (minutes IN (30, 45, 60)),
  paper text NOT NULL CHECK (paper IN ('letter', 'a4')),
  spec jsonb NOT NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, workbook_date, number, minutes)
);
CREATE INDEX amp_workbooks_history_idx
  ON amp_workbooks(learner_id, workbook_date DESC, number DESC);
CREATE INDEX amp_workbooks_code_idx ON amp_workbooks(learner_id, code);
