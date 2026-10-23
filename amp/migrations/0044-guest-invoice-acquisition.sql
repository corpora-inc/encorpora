-- Retain only an internal journey reference, never the cookie bearer token.
-- Expiry/deletion removes the reference without allowing a later visit to refill it.
ALTER TABLE amp_funding_invoice_intents
 ADD COLUMN acquisition_journey_id uuid REFERENCES amp_ad_click_journeys(id) ON DELETE SET NULL,
 ADD COLUMN campaign_attribution jsonb;
