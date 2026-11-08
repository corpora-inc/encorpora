-- Each additional child in a family has its own price (docs/stripe.md). A
-- checkout records which price it sells, chosen when it is reserved, so a
-- retry or a reopened checkout never re-prices. Existing checkouts are full.
ALTER TABLE amp_stripe_checkouts ADD COLUMN price_tier text NOT NULL DEFAULT 'full'
  CHECK (price_tier IN ('full','extra'));
