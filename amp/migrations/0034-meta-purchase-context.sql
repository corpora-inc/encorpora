-- Consented adult confirmation context, bound to a verified initial payment.
-- No payload is sent to Meta by this table or its capture route.
CREATE TABLE amp_meta_purchase_contexts (
 payment_id uuid PRIMARY KEY REFERENCES amp_payment_records(id) ON DELETE CASCADE,
 account_id text NOT NULL,
 checkout_id uuid NOT NULL REFERENCES amp_stripe_checkouts(id) ON DELETE CASCADE,
 namespace text NOT NULL,
 occurred_at timestamptz NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 permission_revision uuid NOT NULL,
 permission_notice text NOT NULL,
 event_source_url text NOT NULL CHECK(event_source_url='https://amp.corpora.inc/start/purchase'),
 client_user_agent text NOT NULL CHECK(length(client_user_agent) BETWEEN 1 AND 512 AND client_user_agent !~ '[^ -~]'),
 CHECK(observed_at>=occurred_at),
 CHECK(expires_at>observed_at AND expires_at<=occurred_at+interval '7 days'),
 UNIQUE(namespace,checkout_id)
);
CREATE INDEX amp_meta_purchase_context_account ON amp_meta_purchase_contexts(account_id);
CREATE INDEX amp_meta_purchase_context_expiry ON amp_meta_purchase_contexts(expires_at);
