-- Preserve historical labels; require a consistent state and funding program.
ALTER TABLE amp_campaign_daily
 DROP CONSTRAINT amp_campaign_daily_state_check,
 DROP CONSTRAINT amp_campaign_daily_program_check,
 DROP CONSTRAINT amp_campaign_daily_campaign_check,
 ADD CONSTRAINT amp_campaign_daily_program_campaign_check CHECK (
   (state='AR' AND program='arkansas-efa' AND campaign IN ('none','ar-efa-launch')) OR
   (state='AZ' AND program='arizona-esa' AND campaign IN ('none','az-esa-launch'))
 );
ALTER TABLE amp_funded_campaign_daily
 DROP CONSTRAINT amp_funded_campaign_daily_campaign_check,
 ADD CONSTRAINT amp_funded_campaign_daily_campaign_check CHECK (campaign IN ('ar-efa-launch','az-esa-launch'));
ALTER TABLE amp_campaign_creative_daily
 DROP CONSTRAINT amp_campaign_creative_daily_campaign_check,
 ADD CONSTRAINT amp_campaign_creative_daily_campaign_check CHECK (campaign IN ('ar-efa-launch','az-esa-launch')),
 DROP CONSTRAINT amp_campaign_creative_daily_creative_check,
 ADD CONSTRAINT amp_campaign_creative_daily_creative_check CHECK (creative IN (
  'az-esa-math',
  'az-homeschool-math',
  'shared-hook-ampd-portrait-v1',
  'shared-hook-ampd-square-v1',
  'shared-hook-next-portrait-v1',
  'shared-hook-next-square-v1',
  'az-hook-ampd-portrait-v1',
  'az-hook-ampd-square-v1',
  'az-hook-next-portrait-v1',
  'az-hook-next-square-v1',
  'efa-math',
  'homeschool-math',
  'efa-product-v1',
  'efa-facebook-feed-v1',
  'efa-facebook-vertical-v1',
  'efa-instagram-vertical-v1',
  'hook-ampd-efa-v2',
  'hook-ampd-assessment-v2',
  'hook-next-efa-v2',
  'hook-next-assessment-v2',
  'hook-path-efa-v2',
  'hook-path-assessment-v2',
  'hook-ampd-up-efa-v2',
  'hook-ampd-up-assessment-v2',
  'hook-plug-efa-v2',
  'hook-plug-assessment-v2'
 ));
ALTER TABLE amp_funding_requests
 DROP CONSTRAINT funding_campaign_program,
 ADD CONSTRAINT funding_campaign_program CHECK (campaign_attribution IS NULL OR (
   (offer_snapshot->>'programId'='ar-efa' AND offer_snapshot->>'jurisdiction'='AR' AND campaign_attribution->>'campaign'='ar-efa-launch') OR
   (offer_snapshot->>'programId'='az-esa' AND offer_snapshot->>'jurisdiction'='AZ' AND campaign_attribution->>'campaign'='az-esa-launch')
 ) IS TRUE);

-- Canonical public landing paths only; never full query strings or arbitrary URLs.
ALTER TABLE amp_ad_click_evidence DROP CONSTRAINT amp_ad_click_evidence_source_url_check,
 ADD CONSTRAINT amp_ad_click_evidence_source_url_check CHECK (source_url IN ('https://corpora.inc/esa/arkansas-efa/','https://corpora.inc/amp/','https://corpora.inc/esa/arizona-esa/'));
