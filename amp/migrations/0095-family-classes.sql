-- Families are classes (docs/families.md). A homeschool family is the smallest
-- org, with one class whose teacher and admin is the parent. Each child keeps
-- the learner the parent's account owns, so purchases, grants, consent,
-- exports, retention and deletion carry over untouched: the family only adds
-- roster rows that point at those learners.
ALTER TABLE amp_orgs DROP CONSTRAINT amp_orgs_kind_check;
ALTER TABLE amp_orgs ADD CONSTRAINT amp_orgs_kind_check
  CHECK (kind IN ('district','network','school','family'));

-- One family org per parent account. `converted_at` marks a family whose
-- children were there before families had classes; the parent sees one line
-- about the new sign-in until they dismiss it.
CREATE TABLE amp_families (
  account_id text PRIMARY KEY CHECK (account_id NOT LIKE 'school:%' AND account_id NOT LIKE 'trial:%'),
  org_id uuid NOT NULL UNIQUE REFERENCES amp_orgs(id),
  class_id uuid NOT NULL REFERENCES amp_classes(id),
  converted_at timestamptz,
  notice_dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
