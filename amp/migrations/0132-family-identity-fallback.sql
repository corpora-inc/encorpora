-- A deterministic UUIDv8 key lets ownership reads expose a missing identity
-- without writing. Persisted identities always win, including older org IDs.
CREATE FUNCTION amp_family_identity(account text) RETURNS uuid
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT overlay(overlay(encode(sha256(convert_to('amp-family-space:v1:' || account,'UTF8')),'hex')
    PLACING '8' FROM 13 FOR 1) PLACING 'a' FROM 17 FOR 1)::char(32)::uuid
$$;

-- Old application instances can still submit random IDs. Normalize only new
-- identities so their first write agrees with the ownership fallback.
CREATE FUNCTION amp_normalize_family_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.id := COALESCE(
    (SELECT id FROM amp_family_spaces WHERE account_id=NEW.account_id),
    (SELECT org_id FROM amp_families WHERE account_id=NEW.account_id),
    amp_family_identity(NEW.account_id));
  RETURN NEW;
END $$;
CREATE TRIGGER amp_normalize_family_identity BEFORE INSERT ON amp_family_spaces
  FOR EACH ROW EXECUTE FUNCTION amp_normalize_family_identity();

-- A legacy class creator chooses its own org ID. Publish the fallback first
-- (before that family row exists) to keep the already-discoverable URL stable.
DROP TRIGGER amp_register_family_identity ON amp_families;
CREATE OR REPLACE FUNCTION amp_register_family_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO amp_family_spaces(account_id,id)
    VALUES(NEW.account_id,amp_family_identity(NEW.account_id))
    ON CONFLICT(account_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_register_family_identity BEFORE INSERT ON amp_families
  FOR EACH ROW EXECUTE FUNCTION amp_register_family_identity();
