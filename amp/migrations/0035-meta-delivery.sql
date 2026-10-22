-- Local identity and delivery receipts only. No email hash or browser payload.
-- Context expiry/deletion must not erase uncertain delivery history.
CREATE TABLE amp_meta_purchase_queue (
 event_id text PRIMARY KEY CHECK(event_id ~ '^amp_meta_[a-f0-9]{64}$'),
 payment_id uuid NOT NULL UNIQUE REFERENCES amp_payment_records(id) ON DELETE CASCADE,
 account_id text NOT NULL,
 namespace text NOT NULL,
 dataset_id text NOT NULL CHECK(dataset_id ~ '^[1-9][0-9]{4,29}$'),
 occurred_at timestamptz NOT NULL,
 original_minor bigint NOT NULL CHECK(original_minor BETWEEN 1 AND 100000000),
 permission_revision uuid NOT NULL,
 permission_notice text NOT NULL,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','cancelled')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX amp_meta_queue_account ON amp_meta_purchase_queue(account_id);
CREATE INDEX amp_meta_queue_expiry ON amp_meta_purchase_queue(occurred_at);
CREATE FUNCTION amp_preserve_meta_purchase_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') THEN
  RAISE EXCEPTION 'Meta purchase identity is immutable';
 END IF;
 IF OLD.state='cancelled' AND NEW.state<>'cancelled' THEN
  RAISE EXCEPTION 'Cancelled Meta purchase cannot be restored';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_meta_purchase_identity_immutable BEFORE UPDATE ON amp_meta_purchase_queue
 FOR EACH ROW EXECUTE FUNCTION amp_preserve_meta_purchase_identity();
CREATE TABLE amp_meta_delivery_attempts (
 id uuid PRIMARY KEY,
 event_id text NOT NULL REFERENCES amp_meta_purchase_queue(event_id) ON DELETE CASCADE,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 100000000),
 state text NOT NULL CHECK(state IN ('unknown','not_sent','rejected','accepted')),
 error_code text CHECK(error_code ~ '^[a-z][a-z0-9_]{0,100}$'),
 receipt jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 CHECK((state='accepted')=(receipt IS NOT NULL))
);
CREATE INDEX amp_meta_attempt_event ON amp_meta_delivery_attempts(event_id,created_at,id);
CREATE UNIQUE INDEX amp_meta_one_unknown ON amp_meta_delivery_attempts(event_id) WHERE state='unknown';
CREATE FUNCTION amp_preserve_meta_delivery_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW.event_id,NEW.amount_minor,NEW.created_at)
 IS DISTINCT FROM ROW(OLD.id,OLD.event_id,OLD.amount_minor,OLD.created_at) THEN
  RAISE EXCEPTION 'Meta attempt identity is immutable';
 END IF;
 IF OLD.state<>'unknown' AND NEW IS DISTINCT FROM OLD THEN
  RAISE EXCEPTION 'Meta delivery outcome is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_meta_delivery_identity_immutable BEFORE UPDATE ON amp_meta_delivery_attempts
 FOR EACH ROW EXECUTE FUNCTION amp_preserve_meta_delivery_identity();
CREATE TABLE amp_meta_collection_cursors (
 config_key text NOT NULL CHECK(config_key ~ '^[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN ('collect','deliver')),
 after_id text,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(config_key,kind)
);
