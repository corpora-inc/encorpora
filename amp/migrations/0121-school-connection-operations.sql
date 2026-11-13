ALTER TABLE amp_clever_connections ADD COLUMN sync_requested_at timestamptz;
ALTER TABLE amp_clever_connections ADD COLUMN sync_paused boolean NOT NULL DEFAULT false;
ALTER TABLE amp_data_agreements ADD COLUMN signer_account_id text;

-- AnySchool's provider invitation is a dashboard operation. Persist the request
-- without pretending that submitting it creates an upstream connection.
CREATE TABLE amp_school_connection_requests (
 id uuid PRIMARY KEY,
 account_id text NOT NULL,
 org_id uuid REFERENCES amp_orgs(id) ON DELETE CASCADE,
 institution_name text NOT NULL,
 contact_email text NOT NULL,
 method text NOT NULL CHECK(method IN ('clever','anyschool')),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','invited','connected','closed')),
 provider_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_school_connection_requests_account_idx ON amp_school_connection_requests(account_id,created_at DESC);
CREATE UNIQUE INDEX amp_school_connection_requests_open_idx ON amp_school_connection_requests(account_id,method,lower(contact_email))
 WHERE status IN ('requested','invited');

-- Operators can review connections whose last pilot ended, but capacity is
-- never a gate on starting a class. Actual upstream disconnection is verified
-- separately and only after all valid coverage has ended.
CREATE TABLE amp_school_connection_tasks (
 id uuid PRIMARY KEY,
 connection_id uuid NOT NULL REFERENCES amp_clever_connections(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('review_release','provider_disconnected')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),
 reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
CREATE UNIQUE INDEX amp_school_connection_tasks_open_idx ON amp_school_connection_tasks(connection_id,kind) WHERE status='open';

ALTER TABLE amp_school_purchase_requests ADD COLUMN license_id uuid REFERENCES amp_school_licenses(id) ON DELETE SET NULL;

-- Bootstrap authority expires per source-owned role, even if an import is
-- requested and then fails. A successful source snapshot clears this deadline.
ALTER TABLE amp_clever_memberships ADD COLUMN bootstrap_valid_until timestamptz;
CREATE FUNCTION amp_school_role_current(role_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(
  SELECT 1 FROM amp_clever_memberships m JOIN amp_clever_connections c ON c.id=m.connection_id
   JOIN amp_org_roles r ON r.id=m.local_id JOIN amp_people p ON p.id=r.person_id
  WHERE m.kind='org_role' AND m.local_id=$1 AND m.owned AND r.role='admin'
   AND (c.status<>'active' OR m.bootstrap_valid_until<=now() OR NOT EXISTS(
     SELECT 1 FROM amp_clever_bindings b WHERE b.connection_id=c.id AND b.kind='user'
       AND b.local_id=p.id AND b.archived_at IS NULL AND b.metadata->'roles' @> '["district_admin"]'::jsonb
       AND NOT EXISTS(SELECT 1 FROM amp_provider_identities i WHERE i.account_id=p.account_id
         AND i.environment=c.environment AND i.district_id=c.district_id AND i.subject=b.clever_id
         AND NOT i.claims->'roles' @> '["district_admin"]'::jsonb)
   ))
 )
$$;
