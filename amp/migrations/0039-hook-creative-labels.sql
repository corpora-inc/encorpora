-- Retain all published labels while adding the reviewed hook-library vocabulary.
-- These are authored creative labels, never provider IDs or user-supplied text.
ALTER TABLE amp_campaign_creative_daily
  DROP CONSTRAINT amp_campaign_creative_daily_creative_check,
  ADD CONSTRAINT amp_campaign_creative_daily_creative_check
  CHECK (creative IN (
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
