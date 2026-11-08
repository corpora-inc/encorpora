-- A child from another family joins a family class once their own parent
-- approves (docs/families.md, step 5). The family's teacher names the child
-- and their parent's address; the parent opens the link, gives verified
-- consent the usual way, and approves. The child is then a learner of the
-- approving parent's account, rostered in the teacher's class. Until then
-- there is no learner and no roster row, so nobody can sign in as them.
--
-- `child_name` and `parent_email` are what the teacher typed. They are erased
-- when the parent approves (the learner holds the name from then on) and when
-- the link ends, and the privacy worker deletes links nobody approved.
CREATE TABLE amp_family_approvals (
  id uuid PRIMARY KEY,
  family_account_id text NOT NULL REFERENCES amp_families(account_id),
  class_id uuid NOT NULL REFERENCES amp_classes(id),
  child_name text CHECK (child_name IS NULL OR length(child_name) BETWEEN 1 AND 60),
  parent_email text CHECK (parent_email IS NULL OR length(parent_email) <= 254),
  lookup_hash text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  sends integer NOT NULL DEFAULT 0,
  -- The parent who opened the link. Single use: nobody else can after them.
  account_id text CHECK (account_id IS NULL OR (account_id NOT LIKE 'school:%' AND account_id NOT LIKE 'trial:%')),
  opened_at timestamptz,
  approved_at timestamptz,
  person_id uuid REFERENCES amp_people(id),
  -- The teacher removed the child or withdrew the link.
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (approved_at IS NULL OR (account_id IS NOT NULL AND person_id IS NOT NULL))
);
CREATE INDEX amp_family_approvals_family_idx ON amp_family_approvals(family_account_id, created_at);
CREATE INDEX amp_family_approvals_account_idx ON amp_family_approvals(account_id) WHERE account_id IS NOT NULL;
