-- A family gift covers every child of the account that activates it, and each
-- child added while it lasts, with one grant per child. Existing gifts each
-- cover one learner, as before.
ALTER TABLE amp_access_gifts ADD COLUMN covers text NOT NULL DEFAULT 'learner'
  CHECK (covers IN ('learner','family'));
