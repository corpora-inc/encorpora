-- Classroom authorization is distinct from an institution-wide agreement.
CREATE TABLE amp_class_authorizations (
 id uuid PRIMARY KEY,
 class_id uuid NOT NULL REFERENCES amp_classes(id),
 account_id text NOT NULL,
 signer_person_id uuid NOT NULL REFERENCES amp_people(id),
 version text NOT NULL,
 signer_name text NOT NULL,
 signer_title text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz
);
CREATE INDEX amp_class_authorizations_class_idx ON amp_class_authorizations(class_id,accepted_at DESC);

-- Eligibility belongs to the adult account, not a reconnectable installation,
-- academic year, school or class. A class can consume only one initial pilot.
CREATE TABLE amp_teacher_pilots (
 id uuid PRIMARY KEY,
 account_id text NOT NULL UNIQUE,
 started_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 grace_ends_at timestamptz NOT NULL,
 CHECK(ends_at>started_at AND grace_ends_at>=ends_at)
);
CREATE TABLE amp_class_pilots (
 class_id uuid PRIMARY KEY REFERENCES amp_classes(id),
 pilot_id uuid NOT NULL REFERENCES amp_teacher_pilots(id),
 activated_by uuid NOT NULL REFERENCES amp_people(id),
 activated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE amp_pilot_eligibility (
 identity_digest text PRIMARY KEY,
 pilot_id uuid NOT NULL REFERENCES amp_teacher_pilots(id)
);
CREATE INDEX amp_class_pilots_pilot_idx ON amp_class_pilots(pilot_id);
CREATE TABLE amp_pilot_extensions (
 id uuid PRIMARY KEY,
 pilot_id uuid NOT NULL REFERENCES amp_teacher_pilots(id),
 until_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 1 AND 1000),
 operator_reference text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- A request key survives reloads and concurrent retries without duplicating a
-- school, class or roster. School names and email domains are never identities.
CREATE TABLE amp_school_starts (
 account_id text NOT NULL,
 request_id uuid NOT NULL,
 org_id uuid NOT NULL REFERENCES amp_orgs(id),
 class_id uuid NOT NULL REFERENCES amp_classes(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,request_id)
);

-- NULL covers the org subtree. An explicit class list covers only those classes.
ALTER TABLE amp_school_licenses ADD COLUMN class_ids uuid[];
ALTER TABLE amp_school_licenses ADD CONSTRAINT amp_school_license_class_scope
 CHECK(class_ids IS NULL OR cardinality(class_ids)>0);

CREATE TABLE amp_school_purchase_requests (
 id uuid PRIMARY KEY,
 account_id text NOT NULL,
 org_id uuid NOT NULL REFERENCES amp_orgs(id),
 class_ids uuid[] NOT NULL,
 seats integer NOT NULL CHECK(seats>0),
 note text NOT NULL DEFAULT '',
 buyer_token_hash text NOT NULL UNIQUE,
 token_expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','quoted','awaiting_po','invoiced','active','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Family and demo learners keep their own allowance. Real school learners are
-- covered by a pilot or a grant; an expired pilot cannot spend a free balance.
CREATE FUNCTION amp_school_managed(learner text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM amp_people p JOIN amp_orgs o ON o.id=p.tenant_id
  JOIN amp_learners l ON l.id=p.learner_id
  WHERE p.learner_id=learner AND o.kind<>'family' AND NOT o.demo
    AND l.account_id='school:'||p.id)
$$;

CREATE FUNCTION amp_school_pilot_until(learner text) RETURNS timestamptz LANGUAGE sql STABLE AS $$
 SELECT max(greatest(t.grace_ends_at,(SELECT max(x.until_at) FROM amp_pilot_extensions x WHERE x.pilot_id=t.id)))
 FROM amp_people p JOIN amp_enrollments e ON e.person_id=p.id AND e.role='student'
 JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
 JOIN amp_orgs o ON o.id=c.org_id AND NOT o.demo AND o.kind<>'family'
 JOIN amp_class_pilots cp ON cp.class_id=c.id
 JOIN amp_teacher_pilots t ON t.id=cp.pilot_id
 WHERE p.learner_id=learner AND p.deleted_at IS NULL
  AND t.started_at<=now()
  AND e.begin_on<=(now() AT TIME ZONE o.timezone)::date
  AND (e.end_on IS NULL OR e.end_on>(now() AT TIME ZONE o.timezone)::date)
  AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id AND r.role='student'
    AND r.org_id=ANY(o.path) AND r.begin_on<=(now() AT TIME ZONE o.timezone)::date
    AND (r.end_on IS NULL OR r.end_on>(now() AT TIME ZONE o.timezone)::date))
$$;

-- A class-scoped seat cannot cover a student who no longer belongs to any of
-- its purchased classes. Other valid grants remain independent coverage.
CREATE FUNCTION amp_school_grant_valid(grant_id text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT grant_id NOT LIKE 'school-seat:%' OR EXISTS(
  SELECT 1 FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
  WHERE s.grant_id=$1 AND s.released_at IS NULL AND l.status='active'
   AND l.starts_at<=now() AND l.ends_at>now() AND
   (l.class_ids IS NULL OR EXISTS(SELECT 1 FROM amp_enrollments e
    JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL JOIN amp_orgs o ON o.id=c.org_id
    WHERE e.person_id=s.person_id AND e.role='student' AND e.class_id=ANY(l.class_ids)
     AND e.begin_on<=(now() AT TIME ZONE o.timezone)::date
     AND (e.end_on IS NULL OR e.end_on>(now() AT TIME ZONE o.timezone)::date)))
 )
$$;
