-- A school owner authorizes one exact destination. A district administrator
-- accepts separately. Only the hash of the single-use handoff token is stored.
CREATE TABLE amp_school_adoptions (
 id uuid PRIMARY KEY,
 token_hash text NOT NULL UNIQUE,
 source_account_id text NOT NULL,
 school_id uuid NOT NULL REFERENCES amp_orgs(id) ON DELETE CASCADE,
 district_id uuid NOT NULL REFERENCES amp_orgs(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 accepted_by_account_id text,
 revoked_at timestamptz,
 CHECK(school_id<>district_id),
 CHECK(expires_at>created_at),
 CHECK((consumed_at IS NULL)=(accepted_by_account_id IS NULL))
);
CREATE INDEX amp_school_adoptions_school_idx ON amp_school_adoptions(school_id,created_at DESC);

-- Root membership is stable for the duration of each roster write. A stale
-- writer that began before adoption must retry against the new org path.
CREATE FUNCTION amp_require_root_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM amp_orgs WHERE id=NEW.tenant_id AND parent_id IS NULL FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Roster tenant must be a root organization' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER amp_people_root_tenant BEFORE INSERT OR UPDATE OF tenant_id ON amp_people
 FOR EACH ROW EXECUTE FUNCTION amp_require_root_tenant();
CREATE TRIGGER amp_external_refs_root_tenant BEFORE INSERT OR UPDATE OF tenant_id ON amp_external_refs
 FOR EACH ROW EXECUTE FUNCTION amp_require_root_tenant();
