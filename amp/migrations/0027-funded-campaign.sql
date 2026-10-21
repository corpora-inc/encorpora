-- Attribution is attached only at request creation. No backfill or guessed source.
-- Linked request labels/markers follow financial retention; unconverted requests expire.
ALTER TABLE amp_funding_requests
  ADD COLUMN campaign_attribution jsonb,
  ADD COLUMN campaign_counted text[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT funding_campaign_program CHECK (
    campaign_attribution IS NULL OR
    (offer_snapshot->>'programId'='ar-efa' AND offer_snapshot->>'jurisdiction'='AR') IS TRUE
  ),
  ADD CONSTRAINT funding_campaign_markers CHECK (
    campaign_counted <@ ARRAY['order_created','order_settled','refund_completed']::text[]
  );

-- Server-written historical counts, not current request states or unique visitors.
-- No account, learner, request, order, visitor, click or provider identifiers.
CREATE TABLE amp_funded_campaign_daily (
  day date NOT NULL,
  campaign text NOT NULL CHECK(campaign='ar-efa-launch'),
  source text NOT NULL CHECK(source IN ('direct','facebook','instagram','google','email','youtube')),
  medium text NOT NULL CHECK(medium IN ('none','paid-social','cpc','email','organic-social')),
  action text NOT NULL CHECK(action IN ('request_prepared','order_created','order_settled','refund_completed')),
  count bigint NOT NULL CHECK(count>0),
  PRIMARY KEY(day,campaign,source,medium,action)
);
