-- A district that connects through Clever starts one free pilot for every
-- class it shares, and every class later made under it (founder ruling
-- 2026-11-20). Students practice the moment they sign in; no teacher starts
-- anything. The pilot is an ordinary amp_teacher_pilots row (30 days, grace,
-- operator extensions), owned by the institution: its eligibility digest is
-- the Clever district's, so reconnecting, or deleting and recreating the
-- district, finds the same dates. Its account_id names no account.
CREATE TABLE amp_org_pilots (
 org_id uuid PRIMARY KEY REFERENCES amp_orgs(id),
 pilot_id uuid NOT NULL REFERENCES amp_teacher_pilots(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_org_pilots_pilot_idx ON amp_org_pilots(pilot_id);

-- A class is covered by its own pilot (a teacher's) or by a pilot of any org
-- on its path (its district's). The rest is 0119's definition, unchanged.
CREATE OR REPLACE FUNCTION amp_school_pilot_until(learner text) RETURNS timestamptz LANGUAGE sql STABLE AS $$
 SELECT max(greatest(t.grace_ends_at,(SELECT max(x.until_at) FROM amp_pilot_extensions x WHERE x.pilot_id=t.id)))
 FROM amp_people p JOIN amp_enrollments e ON e.person_id=p.id AND e.role='student'
 JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
 JOIN amp_orgs o ON o.id=c.org_id AND NOT o.demo AND o.kind<>'family'
 JOIN LATERAL (SELECT cp.pilot_id FROM amp_class_pilots cp WHERE cp.class_id=c.id
   UNION ALL SELECT op.pilot_id FROM amp_org_pilots op WHERE op.org_id=ANY(o.path)) k ON true
 JOIN amp_teacher_pilots t ON t.id=k.pilot_id
 WHERE p.learner_id=learner AND p.deleted_at IS NULL
  AND t.started_at<=now()
  AND e.begin_on<=(now() AT TIME ZONE o.timezone)::date
  AND (e.end_on IS NULL OR e.end_on>(now() AT TIME ZONE o.timezone)::date)
  AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id AND r.role='student'
    AND r.org_id=ANY(o.path) AND r.begin_on<=(now() AT TIME ZONE o.timezone)::date
    AND (r.end_on IS NULL OR r.end_on>(now() AT TIME ZONE o.timezone)::date))
$$;
