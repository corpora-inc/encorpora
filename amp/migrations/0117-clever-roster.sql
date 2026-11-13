-- A connection is an institution's authorization, independent of a license.
-- Credentials live only in protected deployment configuration, never these rows.
CREATE TABLE amp_clever_connections (
 id uuid PRIMARY KEY,
 environment text NOT NULL CHECK(environment IN ('sandbox','production')),
 district_id text NOT NULL CHECK(district_id ~ '^[a-f0-9]{24}$'),
 tenant_id uuid NOT NULL UNIQUE REFERENCES amp_orgs(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','disconnected')),
 connection_type text,
 launch_date date,
 events_enabled boolean NOT NULL DEFAULT false,
 event_cursor text,
 last_full_sync_at timestamptz,
 last_sync_at timestamptz,
 last_clever_sync text,
 disconnected_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(environment,district_id)
);

CREATE TABLE amp_courses (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES amp_orgs(id) ON DELETE CASCADE,
 name text,
 number text,
 archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE amp_classes ADD COLUMN course_id uuid REFERENCES amp_courses(id) ON DELETE SET NULL;

CREATE TABLE amp_clever_sync_runs (
 id uuid PRIMARY KEY,
 connection_id uuid NOT NULL REFERENCES amp_clever_connections(id) ON DELETE CASCADE,
 mode text NOT NULL CHECK(mode IN ('full','events')),
 status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 counts jsonb NOT NULL DEFAULT '{}',
 error_code text
);
CREATE INDEX amp_clever_sync_runs_connection_idx ON amp_clever_sync_runs(connection_id,started_at DESC);

-- record contains only validated, allowlisted roster fields, not arbitrary API
-- payloads (which can contain credentials and sensitive demographics).
CREATE TABLE amp_clever_bindings (
 connection_id uuid NOT NULL REFERENCES amp_clever_connections(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('district','school','user','section','course','term')),
 clever_id text NOT NULL,
 local_id uuid,
 record jsonb NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}',
 archived_at timestamptz,
 last_seen_run_id uuid NOT NULL REFERENCES amp_clever_sync_runs(id),
 PRIMARY KEY(connection_id,kind,clever_id)
);
CREATE INDEX amp_clever_bindings_local_idx ON amp_clever_bindings(local_id);

-- End only memberships created by this source. An existing manual membership
-- may satisfy a source relation, but revoking Clever must never revoke that grant.
CREATE TABLE amp_clever_memberships (
 connection_id uuid NOT NULL REFERENCES amp_clever_connections(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('org_role','enrollment')),
 source_key text NOT NULL,
 local_id uuid NOT NULL,
 owned boolean NOT NULL,
 last_seen_run_id uuid NOT NULL REFERENCES amp_clever_sync_runs(id),
 PRIMARY KEY(connection_id,kind,source_key)
);

-- Individual learner deletion must also remove retained source identity data.
-- A tombstoned person's binding is retained only to prevent silent resurrection.
CREATE FUNCTION amp_clever_scrub_person() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE amp_clever_bindings SET
   record=jsonb_build_object('id',clever_id,'district',record->>'district','name','{}'::jsonb,'roles','{}'::jsonb),
   metadata='{"roles":[]}'::jsonb,
   archived_at=COALESCE(archived_at,now())
 WHERE kind='user' AND local_id=OLD.id;
 RETURN NULL;
END;
$$;
CREATE TRIGGER amp_clever_person_tombstoned AFTER UPDATE ON amp_people
 FOR EACH ROW WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at AND NEW.deleted_at IS NOT NULL)
 EXECUTE FUNCTION amp_clever_scrub_person();
CREATE TRIGGER amp_clever_person_deleted AFTER DELETE ON amp_people
 FOR EACH ROW EXECUTE FUNCTION amp_clever_scrub_person();
