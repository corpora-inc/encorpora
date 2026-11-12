-- A parent corrects a child's birth year in Family (docs/families.md). The
-- change is recorded beside renames, as the other changes to a child's details.
ALTER TABLE amp_privacy_events DROP CONSTRAINT amp_privacy_events_action_check;
ALTER TABLE amp_privacy_events ADD CONSTRAINT amp_privacy_events_action_check CHECK(action IN ('learner.renamed','learner.birth-year-changed','learner.learning-deleted','account.learning-deleted','consent.withdrawn','export.started','export.completed','learner.retention-deleted'));
