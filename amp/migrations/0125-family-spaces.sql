-- A family can own children who are all rostered elsewhere. Its identity does
-- not depend on creating a teaching class. Existing families keep their org ID.
CREATE TABLE amp_family_spaces (
  account_id text PRIMARY KEY CHECK (account_id NOT LIKE 'school:%' AND account_id NOT LIKE 'trial:%'),
  id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO amp_family_spaces(account_id,id) SELECT account_id,org_id FROM amp_families;

-- Account names are independent of any tenant's roster identity.
CREATE TABLE amp_account_profiles (
  account_id text PRIMARY KEY,
  given_name text,
  family_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (given_name IS NULL OR length(given_name) BETWEEN 1 AND 100),
  CHECK (family_name IS NULL OR length(family_name) BETWEEN 1 AND 100)
);
