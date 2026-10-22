-- Local preparation only. No worker or external delivery is enabled by this migration.
CREATE TABLE amp_google_purchase_queue (
 transaction_id text PRIMARY KEY CHECK(transaction_id ~ '^amp_[a-f0-9]{64}$'),
 destination_key text NOT NULL CHECK(destination_key ~ '^[a-f0-9]{64}$'),
 destination jsonb NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('stripe','arkansas-efa')),
 source_id text NOT NULL,
 account_id text NOT NULL,
 occurred_at timestamptz NOT NULL,
 original_minor bigint NOT NULL CHECK(original_minor > 0 AND original_minor <= 100000000),
 net_minor bigint NOT NULL CHECK(net_minor >= 0 AND net_minor <= original_minor),
 currency text NOT NULL CHECK(currency='USD'),
 permission_revision uuid NOT NULL,
 permission_notice text NOT NULL,
 permission_granted_at timestamptz NOT NULL,
 permission_expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','held','cancelled')),
 hold_reason text CHECK(hold_reason IN ('payment_unavailable','refund_pending')),
 cancellation_reason text CHECK(cancellation_reason IN ('withdrawn','permission_changed','payment_changed','expired')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(destination_key,source_kind,source_id),
 CHECK(permission_granted_at <= occurred_at AND permission_expires_at > permission_granted_at),
 CHECK((state='held')=(hold_reason IS NOT NULL)),
 CHECK((state='cancelled')=(cancellation_reason IS NOT NULL))
);
CREATE INDEX amp_google_purchase_queue_account ON amp_google_purchase_queue(account_id);
CREATE INDEX amp_google_purchase_queue_expiry ON amp_google_purchase_queue(occurred_at);
CREATE FUNCTION amp_preserve_google_purchase_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.transaction_id,NEW.destination_key,NEW.destination,NEW.source_kind,NEW.source_id,NEW.account_id,NEW.occurred_at,NEW.original_minor,NEW.currency,NEW.permission_revision,NEW.permission_notice,NEW.permission_granted_at,NEW.permission_expires_at,NEW.created_at)
 IS DISTINCT FROM ROW(OLD.transaction_id,OLD.destination_key,OLD.destination,OLD.source_kind,OLD.source_id,OLD.account_id,OLD.occurred_at,OLD.original_minor,OLD.currency,OLD.permission_revision,OLD.permission_notice,OLD.permission_granted_at,OLD.permission_expires_at,OLD.created_at) THEN
  RAISE EXCEPTION 'Purchase export identity is immutable';
 END IF;
 IF OLD.state='cancelled' AND NEW.state<>'cancelled' THEN
  RAISE EXCEPTION 'Cancelled purchase export cannot be restored';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER amp_google_purchase_identity_immutable BEFORE UPDATE ON amp_google_purchase_queue
 FOR EACH ROW EXECUTE FUNCTION amp_preserve_google_purchase_identity();
