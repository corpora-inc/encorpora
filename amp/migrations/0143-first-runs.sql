-- First-run progress (docs/product-model.md, "First run"): the answer an
-- account gave to "What brings you to AMP?" and when that first run was done.
-- `/me` reads it as `setup`; nothing infers it from whether records exist.
CREATE TABLE amp_first_runs (
 account_id text PRIMARY KEY,
 persona text NOT NULL CHECK(persona IN ('myself','parent','tutor','teacher','school')),
 done_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
