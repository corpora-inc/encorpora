ALTER TABLE amp_learners
  ADD COLUMN birth_year smallint CHECK (birth_year BETWEEN 1900 AND 2100);
