-- First-party acquisition evidence. No external transmission is triggered.
CREATE TABLE amp_ad_click_journeys (
  id uuid PRIMARY KEY,
  token_digest text NOT NULL UNIQUE CHECK(token_digest ~ '^[a-f0-9]{64}$'),
  account_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK(expires_at>created_at AND expires_at<=created_at+interval '2160 hours')
);
CREATE INDEX amp_ad_click_journeys_account ON amp_ad_click_journeys(account_id);
CREATE INDEX amp_ad_click_journeys_expiry ON amp_ad_click_journeys(expires_at);
CREATE TABLE amp_ad_click_evidence (
  id uuid PRIMARY KEY,
  sequence bigserial NOT NULL UNIQUE,
  journey_id uuid NOT NULL REFERENCES amp_ad_click_journeys(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('google','meta')),
  identifiers jsonb NOT NULL CHECK(jsonb_typeof(identifiers)='object' AND octet_length(identifiers::text)<=9000),
  evidence_digest text NOT NULL CHECK(evidence_digest ~ '^[a-f0-9]{64}$'),
  click_digest text NOT NULL CHECK(click_digest ~ '^[a-f0-9]{64}$'),
  first_observed_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(first_observed_at<=observed_at),
  source_url text NOT NULL CHECK(source_url='https://corpora.inc/esa/arkansas-efa/'),
  UNIQUE(journey_id,provider,evidence_digest)
);
CREATE INDEX amp_ad_click_evidence_latest ON amp_ad_click_evidence(journey_id,provider,first_observed_at DESC,sequence DESC);
CREATE INDEX amp_ad_click_evidence_identity ON amp_ad_click_evidence(journey_id,provider,click_digest);
CREATE TABLE amp_ad_order_attribution (
  account_id text NOT NULL,
  funding_request_id text REFERENCES amp_funding_requests(id) ON DELETE CASCADE,
  stripe_checkout_id uuid REFERENCES amp_stripe_checkouts(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('google','meta')),
  click_id uuid REFERENCES amp_ad_click_evidence(id) ON DELETE SET NULL,
  bound_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(num_nonnulls(funding_request_id,stripe_checkout_id)=1),
  UNIQUE(funding_request_id,provider),
  UNIQUE(stripe_checkout_id,provider)
);
CREATE INDEX amp_ad_order_attribution_account ON amp_ad_order_attribution(account_id);
