-- AMP for Schools: the roster, access, license and settings layer on top of
-- amp_learners. Design: docs/schools.md. Learning evidence stays on the learner;
-- nothing here is written during practice.
--
-- Dates: a role or enrollment is active from begin_on up to, but not including,
-- end_on, in the org's own timezone. Ending one today stops access on the next
-- request.
CREATE TABLE amp_orgs (
 id uuid PRIMARY KEY,
 kind text NOT NULL CHECK(kind IN ('district','network','school')),
 parent_id uuid REFERENCES amp_orgs(id),
 path uuid[] NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 200),
 timezone text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT amp_orgs_path_ends_at_self CHECK(path[array_length(path,1)]=id),
 CONSTRAINT amp_orgs_root_has_no_parent CHECK((parent_id IS NULL)=(array_length(path,1)=1))
);
CREATE INDEX amp_orgs_parent_idx ON amp_orgs(parent_id);
CREATE INDEX amp_orgs_path_idx ON amp_orgs USING gin(path);

CREATE TABLE amp_people (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES amp_orgs(id),
 given_name text NOT NULL CHECK(char_length(given_name) BETWEEN 1 AND 100),
 family_name text CHECK(char_length(family_name) BETWEEN 1 AND 100),
 display_name text CHECK(char_length(display_name) BETWEEN 1 AND 100),
 handle text NOT NULL,
 email text,
 identifier text,
 grade_level smallint CHECK(grade_level BETWEEN 0 AND 13),
 account_id text CHECK(account_id NOT LIKE 'school:%'),
 learner_id text UNIQUE REFERENCES amp_learners(id) ON DELETE SET NULL,
 timezone text NOT NULL,
 deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_people_tenant_idx ON amp_people(tenant_id);
CREATE INDEX amp_people_email_idx ON amp_people(email);
CREATE UNIQUE INDEX amp_people_tenant_account_idx ON amp_people(tenant_id,account_id)
 WHERE account_id IS NOT NULL;
CREATE INDEX amp_people_account_idx ON amp_people(account_id) WHERE account_id IS NOT NULL;
-- A deleted learner leaves a tombstone, whichever path deleted it. Registrars
-- keep the record; a token for this person stops working at once.
CREATE FUNCTION amp_people_tombstone_with_learner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.deleted_at := COALESCE(NEW.deleted_at,now());
 RETURN NEW;
END;
$$;
CREATE TRIGGER amp_people_tombstone_with_learner BEFORE UPDATE OF learner_id ON amp_people
 FOR EACH ROW WHEN (OLD.learner_id IS NOT NULL AND NEW.learner_id IS NULL)
 EXECUTE FUNCTION amp_people_tombstone_with_learner();

CREATE TABLE amp_org_roles (
 id uuid PRIMARY KEY,
 person_id uuid NOT NULL REFERENCES amp_people(id),
 org_id uuid NOT NULL REFERENCES amp_orgs(id),
 role text NOT NULL CHECK(role IN ('admin','teacher','aide','viewer','student')),
 begin_on date NOT NULL,
 end_on date,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_on IS NULL OR end_on>=begin_on)
);
CREATE UNIQUE INDEX amp_org_roles_open_idx ON amp_org_roles(person_id,org_id,role) WHERE end_on IS NULL;
CREATE INDEX amp_org_roles_person_idx ON amp_org_roles(person_id);
CREATE INDEX amp_org_roles_org_idx ON amp_org_roles(org_id,role);

CREATE TABLE amp_academic_sessions (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES amp_orgs(id),
 parent_id uuid REFERENCES amp_academic_sessions(id),
 kind text NOT NULL CHECK(kind IN ('year','semester','trimester','quarter','custom')),
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 100),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on)
);
CREATE INDEX amp_academic_sessions_org_idx ON amp_academic_sessions(org_id,kind,starts_on);

CREATE TABLE amp_classes (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES amp_orgs(id),
 session_id uuid NOT NULL REFERENCES amp_academic_sessions(id),
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 100),
 course_bands text[] NOT NULL DEFAULT '{}',
 grading_kind text NOT NULL DEFAULT 'semester'
  CHECK(grading_kind IN ('year','semester','trimester','quarter','custom')),
 join_code text NOT NULL UNIQUE,
 join_failed_count integer NOT NULL DEFAULT 0 CHECK(join_failed_count>=0),
 join_locked_until timestamptz,
 rolled_from uuid REFERENCES amp_classes(id),
 archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_classes_org_idx ON amp_classes(org_id,name);

CREATE TABLE amp_enrollments (
 id uuid PRIMARY KEY,
 class_id uuid NOT NULL REFERENCES amp_classes(id),
 person_id uuid NOT NULL REFERENCES amp_people(id),
 role text NOT NULL CHECK(role IN ('student','teacher','aide')),
 begin_on date NOT NULL,
 end_on date,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_on IS NULL OR end_on>=begin_on)
);
CREATE UNIQUE INDEX amp_enrollments_open_idx ON amp_enrollments(class_id,person_id,role) WHERE end_on IS NULL;
CREATE INDEX amp_enrollments_person_idx ON amp_enrollments(person_id,role);
CREATE INDEX amp_enrollments_class_idx ON amp_enrollments(class_id,role);

CREATE TABLE amp_external_refs (
 tenant_id uuid NOT NULL REFERENCES amp_orgs(id),
 source text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('org','person','session','class','enrollment')),
 sourced_id text NOT NULL,
 local_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,source,kind,sourced_id)
);
CREATE INDEX amp_external_refs_local_idx ON amp_external_refs(local_id);

CREATE TABLE amp_person_credentials (
 id uuid PRIMARY KEY,
 person_id uuid NOT NULL REFERENCES amp_people(id),
 kind text NOT NULL CHECK(kind IN ('card','picture','sso','invite','share')),
 lookup_hash text NOT NULL,
 secret_hash text,
 failed_count integer NOT NULL DEFAULT 0 CHECK(failed_count>=0),
 locked_until timestamptz,
 expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_person_credentials_lookup_idx ON amp_person_credentials(kind,lookup_hash);
CREATE INDEX amp_person_credentials_person_idx ON amp_person_credentials(person_id,kind);

CREATE TABLE amp_student_sessions (
 id uuid PRIMARY KEY,
 token_hash text NOT NULL UNIQUE,
 person_id uuid NOT NULL REFERENCES amp_people(id),
 mode text NOT NULL CHECK(mode IN ('shared','personal')),
 expires_at timestamptz NOT NULL,
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_student_sessions_person_idx ON amp_student_sessions(person_id);

-- The signer's name is copied, so deleting a teacher can't block or rewrite history.
CREATE TABLE amp_data_agreements (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES amp_orgs(id),
 version text NOT NULL,
 signer_person_id uuid REFERENCES amp_people(id) ON DELETE SET NULL,
 signer_name text NOT NULL,
 signer_title text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz
);
CREATE INDEX amp_data_agreements_org_idx ON amp_data_agreements(org_id,accepted_at DESC);

CREATE TABLE amp_school_licenses (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES amp_orgs(id),
 seats integer NOT NULL CHECK(seats>=0),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')),
 reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at)
);
CREATE INDEX amp_school_licenses_org_idx ON amp_school_licenses(org_id,status,ends_at);

CREATE TABLE amp_seats (
 id uuid PRIMARY KEY,
 license_id uuid NOT NULL REFERENCES amp_school_licenses(id),
 person_id uuid NOT NULL REFERENCES amp_people(id),
 grant_id text REFERENCES amp_grants(id) ON DELETE SET NULL,
 assigned_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz
);
CREATE UNIQUE INDEX amp_seats_open_person_idx ON amp_seats(person_id) WHERE released_at IS NULL;
CREATE INDEX amp_seats_open_license_idx ON amp_seats(license_id) WHERE released_at IS NULL;
-- A seat's grant goes with the learner on every deletion path: the seat is free again.
CREATE FUNCTION amp_seats_release_with_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.released_at := COALESCE(NEW.released_at,now());
 RETURN NEW;
END;
$$;
CREATE TRIGGER amp_seats_release_with_grant BEFORE UPDATE OF grant_id ON amp_seats
 FOR EACH ROW WHEN (OLD.grant_id IS NOT NULL AND NEW.grant_id IS NULL)
 EXECUTE FUNCTION amp_seats_release_with_grant();

CREATE TABLE amp_scope_settings (
 scope_kind text NOT NULL CHECK(scope_kind IN ('org','class','person')),
 scope_id uuid NOT NULL,
 "values" jsonb NOT NULL DEFAULT '{}',
 locked text[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(scope_kind,scope_id)
);

-- Anything that changed. Details hold before and after values, never names.
CREATE TABLE amp_school_events (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES amp_orgs(id),
 actor_person_id uuid REFERENCES amp_people(id),
 action text NOT NULL,
 target_kind text NOT NULL,
 target_id text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}',
 "at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_school_events_org_idx ON amp_school_events(org_id,"at" DESC);
CREATE FUNCTION amp_school_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'School event history is append-only';
END;
$$;
CREATE TRIGGER amp_school_events_immutable
 BEFORE UPDATE OR DELETE ON amp_school_events
 FOR EACH ROW EXECUTE FUNCTION amp_school_event_immutable();
