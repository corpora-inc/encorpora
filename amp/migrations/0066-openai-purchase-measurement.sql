ALTER TABLE amp_ad_click_evidence DROP CONSTRAINT amp_ad_click_evidence_provider_check,
 ADD CONSTRAINT amp_ad_click_evidence_provider_check CHECK(provider IN ('google','meta','openai'));
ALTER TABLE amp_ad_order_attribution DROP CONSTRAINT amp_ad_order_attribution_provider_check,
 ADD CONSTRAINT amp_ad_order_attribution_provider_check CHECK(provider IN ('google','meta','openai'));
ALTER TABLE amp_ad_collection_withdrawals DROP CONSTRAINT amp_ad_collection_withdrawals_provider_check,
 ADD CONSTRAINT amp_ad_collection_withdrawals_provider_check CHECK(provider IN ('google','meta','openai'));
ALTER TABLE amp_ad_click_evidence DROP CONSTRAINT amp_ad_click_evidence_source_url_check,
 ADD CONSTRAINT amp_ad_click_evidence_source_url_check CHECK(source_url IN ('https://corpora.inc/esa/arkansas-efa/','https://corpora.inc/amp/','https://corpora.inc/esa/arizona-esa/','https://amp.corpora.inc/'));
CREATE TABLE amp_openai_advertising_permissions (LIKE amp_meta_advertising_permissions INCLUDING ALL);
CREATE TABLE amp_openai_purchase_queue (
 event_id uuid PRIMARY KEY,
 payment_kind text NOT NULL CHECK(payment_kind IN ('stripe','arkansas-efa','arizona-esa')),
 payment_ref text NOT NULL,
 account_id text NOT NULL,
 destination_key text NOT NULL,
 occurred_at timestamptz NOT NULL,
 original_minor integer NOT NULL CHECK(original_minor>0),
 amount_minor integer NOT NULL CHECK(amount_minor>0),
 permission_revision uuid NOT NULL,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','retry','accepted','rejected','cancelled','expired')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 payload_digest text,
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_http_status integer,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(payment_kind,payment_ref)
);
CREATE INDEX amp_openai_queue_due ON amp_openai_purchase_queue(destination_key,next_attempt_at) WHERE state IN ('ready','retry');
CREATE INDEX amp_openai_queue_retention ON amp_openai_purchase_queue(occurred_at);

-- A fair bounded sweep revisits unsettled orders without starving older purchases.
CREATE TABLE amp_openai_purchase_scan (
 payment_kind text NOT NULL CHECK(payment_kind IN ('stripe','arkansas-efa','arizona-esa')),
 payment_ref text NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(payment_kind,payment_ref)
);
