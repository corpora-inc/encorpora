-- Durable external-dispatch boundaries; no recipient or message duplication.
ALTER TABLE amp_consent_outbox
  ADD COLUMN first_dispatch_at timestamptz,
  ADD COLUMN delivery_binding jsonb,
  ADD COLUMN stopped_at timestamptz,
  ADD COLUMN stopped_reason text CHECK (stopped_reason IN ('historical-unknown','binding-changed','retry-window-ended','attempts-exhausted','provider-conflict')),
  ADD CONSTRAINT consent_delivery_binding_pair CHECK ((first_dispatch_at IS NULL) = (delivery_binding IS NULL)),
  ADD CONSTRAINT consent_delivery_stopped_pair CHECK ((stopped_at IS NULL) = (stopped_reason IS NULL));

-- Existing ambiguous attempts have no reliable first-send boundary. Reopening a
-- provider idempotency window could send twice. Preserve them for explicit recovery.
UPDATE amp_consent_outbox SET stopped_at=now(),stopped_reason='historical-unknown',lease_id=NULL,lease_until=NULL
WHERE attempts>0 AND accepted_at IS NULL AND rejected_at IS NULL;

CREATE FUNCTION amp_preserve_consent_dispatch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.first_dispatch_at IS NOT NULL AND
    (NEW.first_dispatch_at IS DISTINCT FROM OLD.first_dispatch_at OR NEW.delivery_binding IS DISTINCT FROM OLD.delivery_binding) THEN
    RAISE EXCEPTION 'Consent dispatch binding is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_consent_dispatch_immutable BEFORE UPDATE ON amp_consent_outbox
FOR EACH ROW EXECUTE FUNCTION amp_preserve_consent_dispatch();
