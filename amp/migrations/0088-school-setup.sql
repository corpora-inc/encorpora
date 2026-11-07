-- First run. `setup_pending` holds an org a person is still setting up through
-- /school/new; an operator's org is created complete. `solo` is "Just my class",
-- which collapses the staff screens. `created_by` bounds self-serve setups.
ALTER TABLE amp_orgs
 ADD COLUMN solo boolean NOT NULL DEFAULT false,
 ADD COLUMN setup_pending boolean NOT NULL DEFAULT false,
 ADD COLUMN created_by text;
CREATE INDEX amp_orgs_created_by_idx ON amp_orgs(created_by) WHERE created_by IS NOT NULL;

-- Staff who arrived through a school aren't parents: no follow-up mail, and no
-- ad measurement. See `markStaffAccount`.
ALTER TABLE amp_account_classification_events
 DROP CONSTRAINT amp_account_classification_events_category_check,
 ADD CONSTRAINT amp_account_classification_events_category_check
  CHECK (category IN ('prospect','friends_family','internal','school_staff'));
ALTER TABLE amp_account_classifications
 DROP CONSTRAINT amp_account_classifications_category_check,
 ADD CONSTRAINT amp_account_classifications_category_check
  CHECK (category IN ('prospect','friends_family','internal','school_staff'));
