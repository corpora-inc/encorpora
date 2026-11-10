-- Practice profiles (docs/families.md): an adult practices as someone else, at
-- a grade and pace they choose or from a student's levels, without touching
-- anyone's record. A profile is a learner owned by the adult's account, marked
-- adult (no birth year, no parental consent: it is the adult's own practice)
-- and marked as a simulation. Its name is the label the adult gave it; its
-- starting levels are its practice settings' strand starts.
--
-- A profile is never the account's own adult learner, so the one-adult rule
-- counts only the real one. Child queries (`NOT adult`) already leave it out.
ALTER TABLE amp_learners
  ADD COLUMN simulation boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT amp_learners_simulation_adult CHECK (NOT simulation OR adult);

DROP INDEX amp_learners_one_adult_idx;
CREATE UNIQUE INDEX amp_learners_one_adult_idx ON amp_learners(account_id)
  WHERE adult AND NOT simulation AND deleted_at IS NULL;

-- An account's profiles, newest first, for the place switcher.
CREATE INDEX amp_learners_simulation_idx ON amp_learners(account_id, created_at)
  WHERE simulation AND deleted_at IS NULL;
