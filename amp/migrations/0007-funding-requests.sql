CREATE TABLE amp_funding_requests (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  offer_id text NOT NULL,
  offer_revision text NOT NULL,
  offer_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','parent-reported-submitted','cancelled')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK(expires_at>created_at),
  order_id text UNIQUE REFERENCES amp_commerce_orders(id),
  conversion_payload jsonb,
  UNIQUE(account_id,idempotency_key),
  CHECK((order_id IS NULL)=(conversion_payload IS NULL))
);
CREATE INDEX amp_funding_requests_account_idx ON amp_funding_requests(account_id,created_at DESC);
CREATE INDEX amp_funding_requests_expiry_idx ON amp_funding_requests(expires_at) WHERE order_id IS NULL;
