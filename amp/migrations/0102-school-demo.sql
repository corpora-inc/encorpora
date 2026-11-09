-- Demo places (docs/schools.md#demo-places): a teacher or school leader
-- explores a fully alive class or school before any agreement or payment.
-- A demo org and everything in it is synthetic: never billed, counted, mailed
-- or converted. It belongs to the account that made it (`created_by`), one per
-- kind, and goes with all its data when that account removes it or after 30
-- days without a visit (`demo_seen_at`, the retention job).
ALTER TABLE amp_orgs
 ADD COLUMN demo boolean NOT NULL DEFAULT false,
 ADD COLUMN demo_kind text CHECK (demo_kind IN ('class','school')),
 ADD COLUMN demo_seen_at timestamptz,
 ADD CONSTRAINT amp_orgs_demo_shape CHECK (
   (demo AND demo_kind IS NOT NULL AND demo_seen_at IS NOT NULL AND parent_id IS NULL
     AND created_by IS NOT NULL AND kind='school')
   OR (NOT demo AND demo_kind IS NULL AND demo_seen_at IS NULL));
CREATE UNIQUE INDEX amp_orgs_demo_owner_idx ON amp_orgs(created_by,demo_kind) WHERE demo;
CREATE INDEX amp_orgs_demo_seen_idx ON amp_orgs(demo_seen_at) WHERE demo;

-- A demo student's practice is covered by a `demo` grant: never revenue, and
-- never the free allowance.
ALTER TABLE amp_grants DROP CONSTRAINT amp_grants_channel_check;
ALTER TABLE amp_grants ADD CONSTRAINT amp_grants_channel_check
 CHECK (channel IN ('pilot','stripe','apple','google','esa','demo'));
