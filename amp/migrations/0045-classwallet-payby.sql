-- Bound to an AMP account's existing immutable funding invoice. Provider emails
-- never identify the learner. Keep credential values out of this table.
CREATE TABLE amp_classwallet_checkouts (
 request_id text PRIMARY KEY REFERENCES amp_funding_requests(id) ON DELETE CASCADE,
 vendor_fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 fetched_at timestamptz,
 purchase_order_id text UNIQUE,
 callback_status text CHECK(callback_status IN ('complete','cancelled')),
 callback_at timestamptz,
 provisioning_payload jsonb,
 retry_at timestamptz NOT NULL DEFAULT now(),
 retry_attempts integer NOT NULL DEFAULT 0,
 stopped_at timestamptz,
 exception_code text,
 exception_at timestamptz
);
