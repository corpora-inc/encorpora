-- Requested invoice follow-up: one reminder before submission and one before
-- the submitted processing deadline. Financial-record deletion removes both.
CREATE TABLE amp_funding_invoice_reminders (
 invoice_id text NOT NULL REFERENCES amp_funding_invoice_intents(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('submission','processing')),
 deadline_at timestamptz NOT NULL,
 available_at timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 lease_id uuid,
 lease_until timestamptz,
 first_dispatch_at timestamptz,
 delivery_binding text,
 accepted_at timestamptz,
 receipt text,
 stopped_at timestamptz,
 stopped_reason text,
 PRIMARY KEY(invoice_id,kind)
);
CREATE INDEX amp_funding_reminders_due ON amp_funding_invoice_reminders(available_at)
 WHERE accepted_at IS NULL AND stopped_at IS NULL;
