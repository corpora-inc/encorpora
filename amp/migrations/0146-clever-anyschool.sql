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

-- One open contact-form request per account and address stays unique; a
-- school's signed AnySchool request is unique per school instead (an advisory
-- lock in the request), so one administrator can ask for two schools with the
-- same setup email. The legacy route's ON CONFLICT names this predicate.
DROP INDEX amp_school_connection_requests_open_idx;
CREATE UNIQUE INDEX amp_school_connection_requests_open_idx ON amp_school_connection_requests(account_id,method,lower(contact_email))
 WHERE status IN ('requested','invited') AND signer_name IS NULL;
