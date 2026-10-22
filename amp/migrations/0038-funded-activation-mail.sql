-- Enqueued in the same transaction as funded access. No recipient or learner
-- name is copied here; deletion of the request also deletes its notification.
CREATE TABLE amp_funded_activation_outbox (
 request_id text PRIMARY KEY REFERENCES amp_funding_requests(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 available_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 lease_id uuid,
 lease_until timestamptz,
 first_dispatch_at timestamptz,
 delivery_binding text,
 accepted_at timestamptz,
 receipt text,
 stopped_at timestamptz,
 stopped_reason text
);
CREATE INDEX amp_funded_activation_due ON amp_funded_activation_outbox(available_at)
 WHERE accepted_at IS NULL AND stopped_at IS NULL;
