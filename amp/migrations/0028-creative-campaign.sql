-- Additive creative breakdown; existing coarse tables and keys are unchanged.
-- Fixed authored labels only. No identity, click ID, URL, or learning evidence.
CREATE TABLE amp_campaign_creative_daily (
  day date NOT NULL,
  campaign text NOT NULL CHECK(campaign='ar-efa-launch'),
  source text NOT NULL CHECK(source IN ('direct','facebook','instagram','google','email','youtube')),
  medium text NOT NULL CHECK(medium IN ('none','paid-social','cpc','email','organic-social')),
  creative text NOT NULL CHECK(creative IN ('efa-math','homeschool-math','efa-product-v1','efa-facebook-feed-v1','efa-facebook-vertical-v1','efa-instagram-vertical-v1')),
  action text NOT NULL CHECK(action IN ('landing_view','try_click','invoice_click','request_prepared','order_created','order_settled','refund_completed')),
  count bigint NOT NULL CHECK(count>0),
  PRIMARY KEY(day,campaign,source,medium,creative,action)
);
