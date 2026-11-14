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

-- Both API generations finish account deletion with this journal insert.
-- The hook also covers non-local identities and survives application rollback.
CREATE FUNCTION amp_erase_family_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM amp_account_profiles WHERE account_id=NEW.account_id;
  DELETE FROM amp_family_spaces WHERE account_id=NEW.account_id;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_erase_family_account AFTER INSERT ON amp_account_deletions
  FOR EACH ROW EXECUTE FUNCTION amp_erase_family_account();

-- Legacy class creation must publish a discoverable identity too. An identity
-- already exposed for hosted children is immutable; org identity is joined via
-- account_id, never inferred from this public URL key.
CREATE FUNCTION amp_register_family_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO amp_family_spaces(account_id,id) VALUES(NEW.account_id,NEW.org_id)
    ON CONFLICT(account_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_register_family_identity AFTER INSERT ON amp_families
  FOR EACH ROW EXECUTE FUNCTION amp_register_family_identity();
