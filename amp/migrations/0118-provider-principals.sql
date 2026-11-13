-- A school provider proves a person, not ownership of an email address.
-- Canonical account ids retain the existing amp| namespace. Better Auth owns
-- mailbox credentials; school-only principals require no synthetic mailbox.
CREATE TABLE amp_provider_principals (
  account_id text PRIMARY KEY CHECK (account_id LIKE 'amp|%'),
  auth_user_id text UNIQUE REFERENCES amp_auth_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE amp_provider_identities (
  id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES amp_provider_principals(account_id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider='clever'),
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  district_id text NOT NULL,
  subject text NOT NULL,
  claims jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,environment,district_id,subject)
);
CREATE INDEX ON amp_provider_identities(account_id);
CREATE TABLE amp_provider_sessions (
  token_hash text PRIMARY KEY,
  identity_id uuid NOT NULL REFERENCES amp_provider_identities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX ON amp_provider_sessions(identity_id);
CREATE TABLE amp_provider_oauth_flows (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  link_account_id text,
  link_proof_hash text,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  consumed_at timestamptz,
  code_hash text UNIQUE,
  CHECK ((link_account_id IS NULL)=(link_proof_hash IS NULL))
);
