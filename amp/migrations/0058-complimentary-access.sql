-- Email reservations are not purchases. Their clock starts on activation.
CREATE TABLE amp_access_gifts (
  id uuid PRIMARY KEY,
  recipient_email text NOT NULL CHECK (recipient_email = lower(btrim(recipient_email))),
  months integer NOT NULL CHECK (months IN (1,12)),
  source text NOT NULL,
  reference text NOT NULL,
  campaign text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  claim_by timestamptz,
  activated_at timestamptz,
  ends_at timestamptz,
  account_id text,
  learner_id text REFERENCES amp_learners(id) ON DELETE SET NULL,
  grant_id text REFERENCES amp_grants(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  UNIQUE(source,reference),
  CHECK ((activated_at IS NULL AND ends_at IS NULL AND account_id IS NULL)
      OR (activated_at IS NOT NULL AND ends_at > activated_at AND account_id IS NOT NULL))
);
CREATE INDEX amp_access_gifts_pending_email ON amp_access_gifts(recipient_email,issued_at,id)
  WHERE activated_at IS NULL AND revoked_at IS NULL;
CREATE INDEX amp_access_gifts_account ON amp_access_gifts(account_id);
