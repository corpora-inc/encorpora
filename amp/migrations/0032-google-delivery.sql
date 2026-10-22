-- No worker is enabled by this migration. Unknown attempts never auto-retry.
CREATE TABLE amp_google_delivery_attempts (
 id uuid PRIMARY KEY,
 transaction_id text NOT NULL REFERENCES amp_google_purchase_queue(transaction_id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('purchase','restate')),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 0 AND 100000000),
 state text NOT NULL CHECK(state IN ('unknown','not_sent','rejected','accepted')),
 error_code text CHECK(error_code ~ '^[a-z][a-z0-9_]{0,100}$'),
 receipt jsonb,
 processing text CHECK(processing IN ('pending','success','issues','failed','timeout')),
 diagnostics jsonb,
 poll_count integer NOT NULL DEFAULT 0 CHECK(poll_count BETWEEN 0 AND 100),
 next_poll_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 CHECK(kind='restate' OR amount_minor>0),
 CHECK((state='accepted')=(receipt IS NOT NULL)),
 CHECK((state='accepted')=(processing IS NOT NULL)),
 CHECK(COALESCE(processing='pending',false)=(next_poll_at IS NOT NULL))
);
CREATE INDEX amp_google_delivery_transaction ON amp_google_delivery_attempts(transaction_id,created_at,id);
CREATE INDEX amp_google_delivery_due ON amp_google_delivery_attempts(next_poll_at) WHERE processing='pending';
CREATE UNIQUE INDEX amp_google_delivery_one_unknown ON amp_google_delivery_attempts(transaction_id) WHERE state='unknown';
CREATE FUNCTION amp_preserve_google_delivery_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW.transaction_id,NEW.kind,NEW.amount_minor,NEW.created_at)
 IS DISTINCT FROM ROW(OLD.id,OLD.transaction_id,OLD.kind,OLD.amount_minor,OLD.created_at) THEN
  RAISE EXCEPTION 'Delivery attempt identity is immutable';
 END IF;
 IF OLD.state<>'unknown' AND NEW.state<>OLD.state THEN
  RAISE EXCEPTION 'Delivery outcome is immutable';
 END IF;
 IF OLD.receipt IS NOT NULL AND NEW.receipt IS DISTINCT FROM OLD.receipt THEN
  RAISE EXCEPTION 'Delivery receipt is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_google_delivery_identity_immutable BEFORE UPDATE ON amp_google_delivery_attempts
 FOR EACH ROW EXECUTE FUNCTION amp_preserve_google_delivery_identity();
CREATE TABLE amp_google_collection_cursors (
 config_key text NOT NULL CHECK(config_key ~ '^[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN ('stripe','arkansas-efa','delivery')),
 after_id text,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(config_key,kind)
);
