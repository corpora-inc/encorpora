CREATE TABLE amp_stripe_customers (
 namespace text NOT NULL,
 account_id text NOT NULL,
 reservation_id uuid NOT NULL,
 customer_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(namespace, account_id),
 UNIQUE(namespace, customer_id)
);
-- Financial bindings survive learner deletion; no child name or card data is stored.
CREATE TABLE amp_stripe_checkouts (
 id uuid PRIMARY KEY,
 namespace text NOT NULL,
 account_id text NOT NULL,
 learner_id text NOT NULL,
 request_id uuid NOT NULL,
 customer_id text,
 session_id text,
 session_url text,
 subscription_id text,
 closed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(namespace, account_id, request_id),
 UNIQUE(namespace, session_id),
 UNIQUE(namespace, subscription_id)
);
CREATE UNIQUE INDEX amp_stripe_one_open_checkout ON amp_stripe_checkouts(namespace, learner_id) WHERE NOT closed;
CREATE TABLE amp_stripe_inbox (
 namespace text NOT NULL,
 event_id text NOT NULL,
 event_type text NOT NULL,
 object_id text NOT NULL,
 event_created bigint NOT NULL,
 payload_hash text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','done','review')),
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid,
 error_code text,
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(namespace,event_id)
);
CREATE INDEX amp_stripe_inbox_pending ON amp_stripe_inbox(namespace,status,available_at);
CREATE TABLE amp_stripe_invoice_evidence (
 namespace text NOT NULL,
 invoice_id text NOT NULL,
 full_refund_at bigint,
 partial_refund boolean NOT NULL DEFAULT false,
 PRIMARY KEY(namespace,invoice_id)
);
