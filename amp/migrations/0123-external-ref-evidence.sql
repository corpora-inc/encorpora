-- Allowlisted source scope, roles, membership dates and academic-session links.
-- No names, credentials, demographic data or arbitrary provider payloads.
ALTER TABLE amp_external_refs ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
