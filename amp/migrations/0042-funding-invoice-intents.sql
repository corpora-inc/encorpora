-- Billing-only invoice preparation precedes an AMP account or learning profile.
CREATE TABLE amp_funding_invoice_intents (
  id text PRIMARY KEY,
  idempotency_key uuid NOT NULL UNIQUE,
  parent_email text NOT NULL,
  student_billing_name text NOT NULL,
  offer_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  received_payment_at timestamptz,
  claimed_account_id text,
  claimed_request_id text UNIQUE REFERENCES amp_funding_requests(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','claimed','cancelled')),
  CHECK ((state='claimed') = (claimed_request_id IS NOT NULL AND claimed_account_id IS NOT NULL)),
  CHECK (claimed_request_id IS NULL OR claimed_request_id=id),
  CHECK (expires_at>created_at)
);
CREATE INDEX amp_funding_invoice_parent ON amp_funding_invoice_intents(parent_email,created_at DESC);
