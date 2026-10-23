-- Provider-verified payments can precede a parent's verified account/learner claim.
-- No parent route may write this table. No names or emails from reports are retained.
CREATE TABLE amp_classwallet_payments (
  order_id text PRIMARY KEY,
  invoice_id text NOT NULL UNIQUE,
  report_sha256 text NOT NULL CHECK (report_sha256 ~ '^[a-f0-9]{64}$'),
  payment_row jsonb NOT NULL,
  verified_config jsonb NOT NULL,
  conversion_payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  stopped_at timestamptz,
  error_code text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_classwallet_payments_pending ON amp_classwallet_payments(next_attempt_at)
 WHERE completed_at IS NULL AND stopped_at IS NULL;
