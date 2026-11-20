-- Clever AnySchool: a school without Clever asks in AMP, an operator sends
-- Clever's dashboard invitation to the setup email, and connects the district
-- once the school's setup is shared with AMP. The request carries the school's
-- acceptance of the student data agreement, which the AnySchool district org
-- receives at connection: an AnySchool district may have no Clever district
-- administrator to accept it in the Clever connect flow.
ALTER TABLE amp_school_connection_requests ADD COLUMN signer_name text;
ALTER TABLE amp_school_connection_requests ADD COLUMN agreement_version text;
ALTER TABLE amp_school_connection_requests ADD COLUMN invited_at timestamptz;
ALTER TABLE amp_school_connection_requests ADD COLUMN clever_environment text
 CHECK(clever_environment IN ('sandbox','production'));
ALTER TABLE amp_school_connection_requests ADD COLUMN clever_district_id text
 CHECK(clever_district_id ~ '^[a-f0-9]{24}$');
ALTER TABLE amp_school_connection_requests ADD COLUMN connection_id uuid
 REFERENCES amp_clever_connections(id) ON DELETE SET NULL;
CREATE INDEX amp_school_connection_requests_org_idx ON amp_school_connection_requests(org_id)
 WHERE org_id IS NOT NULL;
