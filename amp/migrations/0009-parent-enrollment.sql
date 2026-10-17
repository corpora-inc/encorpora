-- Policy is administered separately from API startup. An old instance cannot
-- silently re-enable a disabled or replaced deployment policy.
CREATE TABLE amp_consent_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 generation uuid NOT NULL,
 digest text NOT NULL,
 notice_digest text NOT NULL,
 policy jsonb NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 reviewed_until timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE amp_consent_requests (
 id uuid PRIMARY KEY,
 account_id text NOT NULL,
 idempotency_key uuid NOT NULL,
 policy_generation uuid NOT NULL,
 policy_digest text NOT NULL,
 notice_digest text NOT NULL,
 notice jsonb NOT NULL,
 email_hash text NOT NULL,
 recipient_ciphertext text,
 nonce text NOT NULL,
 phase text NOT NULL CHECK(phase IN ('awaiting-initial','awaiting-confirmation','active','withdrawn','expired','replaced')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 confirmation_after timestamptz,
 initial_at timestamptz,
 completed_at timestamptz,
 withdrawn_at timestamptz,
 purge_after timestamptz,
 UNIQUE(account_id,idempotency_key)
);
CREATE UNIQUE INDEX amp_consent_requests_current ON amp_consent_requests(account_id) WHERE phase IN ('awaiting-initial','awaiting-confirmation','active');
CREATE INDEX amp_consent_requests_purge ON amp_consent_requests(expires_at,purge_after);
CREATE TABLE amp_consent_outbox (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES amp_consent_requests(id) ON DELETE CASCADE,
 stage text NOT NULL CHECK(stage IN ('initial','confirmation')),
 available_at timestamptz NOT NULL,
 lease_id uuid,
 lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 accepted_at timestamptz,
 receipt text,
 rejected_at timestamptz,
 UNIQUE(request_id,stage)
);
CREATE INDEX amp_consent_outbox_due ON amp_consent_outbox(available_at) WHERE accepted_at IS NULL AND rejected_at IS NULL;
