-- A teacher's short-lived Google Classroom access for one roster import. The
-- token is encrypted with a key derived from the server secret, never leaves
-- the server, and the row is deleted as soon as the course's students are read
-- (or when it expires, whichever is first).
CREATE TABLE amp_google_classroom_grants (
  account_id text NOT NULL,
  org_id uuid NOT NULL REFERENCES amp_orgs(id) ON DELETE CASCADE,
  sealed_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (account_id, org_id)
);
CREATE INDEX amp_google_classroom_grants_expiry ON amp_google_classroom_grants(expires_at);
