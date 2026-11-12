-- One shared demo school per demo time zone (docs/schools.md#demo-places).
-- Every visitor who asks for a demo class or school joins the zone's current
-- school instead of getting one of their own. Its content is static: the
-- same students and answers every day, with the dates moved so it ends today.
-- Each night a new school is written for the coming day and the old one goes
-- through the tree removal after a grace period.

-- A zone's school for one day. The current one is the newest built row whose
-- day has begun in the zone, so the pointer moves at the zone's midnight, on
-- every pod at once, and only to a school that is fully written: `built_at`
-- is set in the transaction that writes it. A pod claims a day by setting
-- `building_until`. `org_id` and `class_ids` stay after the org is removed,
-- so a visitor holding an old link is sent to the current school.
CREATE TABLE amp_demo_schools (
  timezone text NOT NULL,
  day date NOT NULL,
  org_id uuid UNIQUE,
  hero_class_id uuid,
  class_ids uuid[] NOT NULL DEFAULT '{}',
  building_until timestamptz,
  built_at timestamptz,
  -- When the hero class's presence was last moved to the present.
  presence_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (timezone, day)
);

-- A visitor of the shared demo: who they are there, whether they asked for
-- the school (admin) or a class (the hero class's teacher), and when they were
-- last here. On their next request after the nightly switch, their place
-- moves to the new school. Idle for 30 days, it goes (the retention job).
CREATE TABLE amp_demo_visitors (
  account_id text PRIMARY KEY,
  timezone text NOT NULL,
  admin boolean NOT NULL,
  org_id uuid NOT NULL,
  person_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_demo_visitors_seen_idx ON amp_demo_visitors(seen_at);

-- A visitor's person in a shared demo. Visitors never see each other: every
-- list of staff, teachers or activity leaves out a visitor who isn't the
-- viewer. The made-up teachers and students have no account and are never
-- visitors.
ALTER TABLE amp_people ADD COLUMN demo_visitor boolean NOT NULL DEFAULT false;
