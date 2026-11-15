-- Minimum compliance: no law sets a review date for the parental-consent
-- policy (COPPA requires new notice and consent only for material changes,
-- 16 CFR 312.4 and 312.5(a)). Consent and card checkout no longer shut off
-- when a self-imposed review date passes.
UPDATE amp_consent_policy SET reviewed_until='infinity';
