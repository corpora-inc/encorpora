-- Teachers and school leaders start without an AMP operator, a confirmed
-- mailbox or a job title (founder ruling 2026-11-15). No law asks for the
-- signer's title, so it is no longer collected.
ALTER TABLE amp_class_authorizations ALTER COLUMN signer_title DROP NOT NULL;
ALTER TABLE amp_data_agreements ALTER COLUMN signer_title DROP NOT NULL;

-- An unconfirmed mailbox shares the pilot its mailbox already used, but its
-- claim never binds the confirmed owner of that mailbox to someone else's dates.
ALTER TABLE amp_pilot_eligibility ADD COLUMN confirmed boolean NOT NULL DEFAULT true;

-- A school leader's self-serve start makes a school before its first class.
ALTER TABLE amp_school_starts ALTER COLUMN class_id DROP NOT NULL;
