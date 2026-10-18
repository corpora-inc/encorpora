ALTER TABLE amp_stripe_checkouts ADD COLUMN billing_interval text NOT NULL DEFAULT 'year' CHECK (billing_interval IN ('year','month'));
CREATE FUNCTION amp_checkout_interval_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.billing_interval IS DISTINCT FROM OLD.billing_interval THEN RAISE EXCEPTION 'checkout interval is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_checkout_interval_immutable BEFORE UPDATE ON amp_stripe_checkouts FOR EACH ROW EXECUTE FUNCTION amp_checkout_interval_immutable();
-- Provider-verified renewal/cancellation observations; paid access remains invoice-owned.
CREATE TABLE amp_stripe_subscription_events (
 namespace text NOT NULL,
 event_id text NOT NULL,
 checkout_id uuid NOT NULL REFERENCES amp_stripe_checkouts(id),
 subscription_id text NOT NULL,
 status text NOT NULL,
 cancel_at_period_end boolean NOT NULL,
 period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(namespace,event_id),
 CHECK(period_end > period_start)
);
