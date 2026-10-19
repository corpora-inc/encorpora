-- Adult-only checkout and receipt ownership precede any learner profile.
ALTER TABLE amp_stripe_checkouts ALTER COLUMN learner_id DROP NOT NULL;
ALTER TABLE amp_stripe_checkouts ADD COLUMN assigned_learner_id text;
ALTER TABLE amp_stripe_checkouts ADD COLUMN creation_started_at timestamptz;
ALTER TABLE amp_payment_records ALTER COLUMN learner_id DROP NOT NULL;
CREATE UNIQUE INDEX amp_stripe_one_open_enrollment ON amp_stripe_checkouts(namespace,account_id) WHERE learner_id IS NULL AND NOT closed;
CREATE TABLE amp_purchase_consents (
 checkout_id uuid PRIMARY KEY REFERENCES amp_stripe_checkouts(id),
 account_id text NOT NULL,
 policy_generation uuid NOT NULL,
 policy_digest text NOT NULL,
 notice_digest text NOT NULL,
 notice jsonb NOT NULL,
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 consent_at timestamptz,
 invoice_id text,
 customer_id text,
 revoked_at timestamptz,
 purge_after timestamptz
);
CREATE INDEX amp_purchase_consents_account ON amp_purchase_consents(account_id);
CREATE FUNCTION amp_purchase_notice_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.checkout_id,NEW.account_id,NEW.policy_generation,NEW.policy_digest,NEW.notice_digest,NEW.notice,NEW.acknowledged_at,NEW.expires_at)
 IS DISTINCT FROM (OLD.checkout_id,OLD.account_id,OLD.policy_generation,OLD.policy_digest,OLD.notice_digest,OLD.notice,OLD.acknowledged_at,OLD.expires_at)
 OR (OLD.consent_at IS NOT NULL AND (NEW.consent_at,NEW.invoice_id,NEW.customer_id) IS DISTINCT FROM (OLD.consent_at,OLD.invoice_id,OLD.customer_id))
 OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
 RAISE EXCEPTION 'Purchase notice and completed consent bindings are immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_purchase_notice_immutable BEFORE UPDATE ON amp_purchase_consents FOR EACH ROW EXECUTE FUNCTION amp_purchase_notice_immutable();
CREATE TABLE amp_account_entitlements (
 namespace text NOT NULL,
 invoice_id text NOT NULL,
 checkout_id uuid NOT NULL REFERENCES amp_stripe_checkouts(id),
 payment jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('active','refunded','held')),
 ends_at timestamptz NOT NULL,
 PRIMARY KEY(namespace,invoice_id)
);
CREATE FUNCTION amp_purchase_assignment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.assigned_learner_id IS NOT NULL AND NEW.assigned_learner_id IS DISTINCT FROM OLD.assigned_learner_id THEN RAISE EXCEPTION 'Purchase assignment is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_purchase_assignment_immutable BEFORE UPDATE ON amp_stripe_checkouts FOR EACH ROW EXECUTE FUNCTION amp_purchase_assignment_immutable();
-- Only a definitively rejected initial consent payment schedules this action.
-- The settled payment and receipt remain available for parent/support review.
CREATE TABLE amp_enrollment_cancellations (
 checkout_id uuid PRIMARY KEY REFERENCES amp_stripe_checkouts(id),
 subscription_id text NOT NULL,
 reason text NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT now(),
 available_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 error_code text,
 completed_at timestamptz
);
