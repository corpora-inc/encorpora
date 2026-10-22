-- Meta permission is independent of Google and learning consent. No learner FK.
CREATE TABLE amp_meta_advertising_permissions (
  account_id text PRIMARY KEY,
  revision uuid NOT NULL,
  notice_version text NOT NULL,
  adult_attested boolean NOT NULL,
  email_digest text,
  granted_at timestamptz,
  expires_at timestamptz,
  withdrawn_at timestamptz,
  CHECK ((granted_at IS NULL AND expires_at IS NULL) OR (granted_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at > granted_at)),
  CHECK (email_digest IS NULL OR email_digest ~ '^[a-f0-9]{64}$'),
  CHECK ((withdrawn_at IS NULL AND email_digest IS NOT NULL AND adult_attested AND granted_at IS NOT NULL AND expires_at IS NOT NULL) OR
         (withdrawn_at IS NOT NULL AND email_digest IS NULL))
);
CREATE INDEX amp_meta_advertising_permission_expiry ON amp_meta_advertising_permissions
  ((COALESCE(withdrawn_at, expires_at)));
