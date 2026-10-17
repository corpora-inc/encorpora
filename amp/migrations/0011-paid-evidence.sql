-- Financial facts retain opaque learner references, never child names or payment credentials.
ALTER TABLE amp_stripe_checkouts ADD COLUMN document_profile jsonb;
CREATE FUNCTION amp_preserve_checkout_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.document_profile IS DISTINCT FROM OLD.document_profile THEN
  RAISE EXCEPTION 'Purchase-time document profile is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_checkout_profile_immutable BEFORE UPDATE ON amp_stripe_checkouts
 FOR EACH ROW EXECUTE FUNCTION amp_preserve_checkout_profile();
CREATE TABLE amp_payment_records (
 id uuid PRIMARY KEY,
 namespace text NOT NULL,
 invoice_id text NOT NULL,
 checkout_id uuid NOT NULL REFERENCES amp_stripe_checkouts(id),
 account_id text NOT NULL,
 learner_id text NOT NULL,
 baseline jsonb,
 baseline_sha256 text,
 status text NOT NULL CHECK(status IN ('verified','review')),
 review_reason text,
 observed_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 UNIQUE(namespace,invoice_id),
 CHECK ((baseline IS NULL) = (baseline_sha256 IS NULL))
);
CREATE INDEX amp_payment_records_account ON amp_payment_records(account_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX amp_payment_charge_unique ON amp_payment_records(namespace,(baseline->>'chargeId')) WHERE baseline IS NOT NULL;
CREATE TABLE amp_payment_observations (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id uuid NOT NULL UNIQUE,
 record_id uuid NOT NULL REFERENCES amp_payment_records(id),
 observation jsonb NOT NULL,
 observation_sha256 text NOT NULL,
 source_event_id text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_payment_observations_record ON amp_payment_observations(record_id, sequence);
CREATE FUNCTION amp_preserve_payment_baseline() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.baseline IS NOT NULL AND (NEW.baseline IS DISTINCT FROM OLD.baseline OR NEW.baseline_sha256 IS DISTINCT FROM OLD.baseline_sha256) THEN
  RAISE EXCEPTION 'Payment baseline is immutable';
 END IF;
 IF NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.namespace IS DISTINCT FROM OLD.namespace OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR NEW.checkout_id IS DISTINCT FROM OLD.checkout_id OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.learner_id IS DISTINCT FROM OLD.learner_id THEN
  RAISE EXCEPTION 'Payment ownership is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_payment_baseline_immutable BEFORE UPDATE ON amp_payment_records
 FOR EACH ROW EXECUTE FUNCTION amp_preserve_payment_baseline();
CREATE FUNCTION amp_preserve_payment_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Payment observations are append-only'; END $$;
CREATE TRIGGER amp_payment_observation_immutable BEFORE UPDATE OR DELETE ON amp_payment_observations
 FOR EACH ROW EXECUTE FUNCTION amp_preserve_payment_observation();
-- A provider credit note may arrive before a checkout can be resolved. Retain its
-- invoice-level hold independently; later invoices cannot erase it by changing status.
CREATE TABLE amp_payment_holds (
 namespace text NOT NULL,
 invoice_id text NOT NULL,
 credit_note_id text NOT NULL,
 source_event_id text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(namespace,invoice_id,credit_note_id)
);
CREATE TRIGGER amp_payment_hold_immutable BEFORE UPDATE OR DELETE ON amp_payment_holds
 FOR EACH ROW EXECUTE FUNCTION amp_preserve_payment_observation();
