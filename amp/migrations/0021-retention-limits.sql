-- Financial evidence stays append-only for every application writer. Only the
-- retention job, inside a transaction that sets amp.retention_purge, may delete
-- rows whose published financial retention period has ended.
CREATE OR REPLACE FUNCTION amp_commerce_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_setting('amp.retention_purge',true)='financial' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Commerce event history is append-only';
END;
$$;
CREATE OR REPLACE FUNCTION amp_preserve_payment_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_setting('amp.retention_purge',true)='financial' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Payment observations are append-only';
END $$;
-- Refund evidence can precede its payment record; a time lets it age out.
ALTER TABLE amp_stripe_invoice_evidence ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT now();
-- Retention deletions are recorded separately from parent requests.
ALTER TABLE amp_privacy_events DROP CONSTRAINT amp_privacy_events_action_check;
ALTER TABLE amp_privacy_events ADD CONSTRAINT amp_privacy_events_action_check CHECK(action IN ('learner.renamed','learner.learning-deleted','account.learning-deleted','consent.withdrawn','export.started','export.completed','learner.retention-deleted'));
CREATE INDEX amp_trial_events_time_idx ON amp_trial_events(occurred_at);
CREATE INDEX amp_trials_created_idx ON amp_trials(created_at);
-- Retention scans join these foreign keys.
CREATE INDEX amp_grants_learner_idx ON amp_grants(learner_id);
CREATE INDEX amp_stripe_checkouts_account_idx ON amp_stripe_checkouts(account_id);
CREATE INDEX amp_payment_records_checkout_idx ON amp_payment_records(checkout_id);
CREATE INDEX amp_account_entitlements_checkout_idx ON amp_account_entitlements(checkout_id);
CREATE INDEX amp_subscription_events_checkout_idx ON amp_stripe_subscription_events(checkout_id);
