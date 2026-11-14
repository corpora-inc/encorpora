-- Invoice access is a revocable bridge, independent of verified commerce.
ALTER TABLE amp_access_gifts ADD COLUMN funding_invoice_id text UNIQUE
  REFERENCES amp_funding_invoice_intents(id) ON DELETE CASCADE;
ALTER TABLE amp_access_gifts ADD CONSTRAINT funded_pending_invoice_required
  CHECK ((source='funded-pending') = (funding_invoice_id IS NOT NULL));

CREATE FUNCTION revoke_deleted_funded_pending_gift() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source='funded-pending' AND OLD.grant_id IS NOT NULL THEN
    UPDATE amp_grants SET status='revoked' WHERE id=OLD.grant_id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER revoke_deleted_funded_pending_gift BEFORE DELETE ON amp_access_gifts
  FOR EACH ROW EXECUTE FUNCTION revoke_deleted_funded_pending_gift();

-- Immutable attachment bytes keep ambiguous delivery retries identical.
CREATE TABLE amp_funding_invoice_outbox (
 invoice_id text PRIMARY KEY REFERENCES amp_funding_invoice_intents(id) ON DELETE CASCADE,
 pdf_base64 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 available_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 lease_id uuid,
 lease_until timestamptz,
 first_dispatch_at timestamptz,
 delivery_binding text,
 accepted_at timestamptz,
 receipt text,
 stopped_at timestamptz,
 stopped_reason text
);
CREATE INDEX amp_funding_invoice_mail_due ON amp_funding_invoice_outbox(available_at)
 WHERE accepted_at IS NULL AND stopped_at IS NULL;

-- Eligibility belongs to the adult and program, never a disposable child record.
-- Learning-data deletion must not restart it; account deletion erases it.
CREATE TABLE amp_funded_pending_eligibility (
 account_id text NOT NULL,
 recipient_email text NOT NULL CHECK (recipient_email=lower(btrim(recipient_email))),
 program_id text NOT NULL,
 used_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (account_id,program_id),
 UNIQUE (recipient_email,program_id)
);
