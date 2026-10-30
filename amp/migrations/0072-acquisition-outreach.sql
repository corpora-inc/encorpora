-- Private operator state. Attribution, learning and payments keep their existing
-- sources of truth; correspondence references the acquisition account.
CREATE TABLE amp_acquisition_contacts (
  user_id text PRIMARY KEY REFERENCES amp_parent_followups(user_id) ON DELETE CASCADE,
  next_contact_at timestamptz NOT NULL,
  time_zone text NOT NULL,
  time_zone_basis text NOT NULL CHECK(time_zone_basis IN ('campaign','default','confirmed')),
  hold_reason text,
  suppressed_at timestamptz,
  suppression_reason text,
  mailbox_checked_at timestamptz,
  mailbox_checked_for text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((suppressed_at IS NULL) = (suppression_reason IS NULL))
);
CREATE TABLE amp_acquisition_messages (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES amp_acquisition_contacts(user_id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK(purpose IN ('welcome','reply','followup')),
  intent_key text NOT NULL,
  sender text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  body text,
  content_hash text,
  draft_id text,
  status text NOT NULL CHECK(status IN ('draft','approved','sending','sent','cancelled')),
  approved_at timestamptz,
  approval_reference text,
  claimed_at timestamptz,
  claim_id uuid,
  sent_at timestamptz,
  provider_message_id text,
  provider_thread_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,intent_key),
  UNIQUE(sender,provider_message_id),
  CHECK(purpose <> 'welcome' OR intent_key='welcome'),
  CHECK(status NOT IN ('draft','approved','sending') OR (body IS NOT NULL AND content_hash IS NOT NULL AND draft_id IS NOT NULL)),
  CHECK(status NOT IN ('approved','sending') OR (approved_at IS NOT NULL AND approval_reference IS NOT NULL)),
  CHECK(status <> 'sending' OR (claim_id IS NOT NULL AND claimed_at IS NOT NULL)),
  CHECK(status <> 'sent' OR (sent_at IS NOT NULL AND provider_message_id IS NOT NULL AND provider_thread_id IS NOT NULL))
);
CREATE INDEX amp_acquisition_message_contact ON amp_acquisition_messages(user_id,created_at);
CREATE TABLE amp_acquisition_contact_events (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES amp_acquisition_contacts(user_id) ON DELETE CASCADE,
  event_key text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('reply','optout','bounce','mailbox_checked','hold','release','draft','approved','claimed','sent','cancelled')),
  occurred_at timestamptz NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,event_key)
);
CREATE INDEX amp_acquisition_contact_event_time ON amp_acquisition_contact_events(user_id,occurred_at);

-- A campaign location is a scheduling assumption, not proof of residence.
CREATE FUNCTION amp_enroll_acquisition_contact() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tz text;
BEGIN
  IF NEW.new_account THEN
    tz := CASE NEW.program WHEN 'ar-efa' THEN 'America/Chicago' WHEN 'az-esa' THEN 'America/Phoenix' ELSE 'America/New_York' END;
    INSERT INTO amp_acquisition_contacts(user_id,next_contact_at,time_zone,time_zone_basis)
      VALUES(NEW.user_id,((COALESCE(NEW.verified_at,NEW.created_at) AT TIME ZONE tz)::date + interval '1 day 12 hours') AT TIME ZONE tz,tz,
        CASE WHEN NEW.program IS NULL THEN 'default' ELSE 'campaign' END)
      ON CONFLICT(user_id) DO UPDATE SET next_contact_at=greatest(amp_acquisition_contacts.next_contact_at,excluded.next_contact_at);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_enroll_acquisition_contact AFTER INSERT OR UPDATE OF verified_at ON amp_parent_followups
  FOR EACH ROW EXECUTE FUNCTION amp_enroll_acquisition_contact();

INSERT INTO amp_acquisition_contacts(user_id,next_contact_at,time_zone,time_zone_basis)
SELECT user_id,((COALESCE(verified_at,created_at) AT TIME ZONE tz)::date + interval '1 day 12 hours') AT TIME ZONE tz,tz,
  CASE WHEN program IS NULL THEN 'default' ELSE 'campaign' END
FROM (SELECT *,CASE program WHEN 'ar-efa' THEN 'America/Chicago' WHEN 'az-esa' THEN 'America/Phoenix' ELSE 'America/New_York' END tz
  FROM amp_parent_followups WHERE new_account) p;

-- Founder-managed acquisition cannot also enter the generic welcome sequence.
UPDATE amp_parent_followup_outbox SET stopped_at=now(),stopped_reason='founder-managed'
WHERE accepted_at IS NULL AND stopped_at IS NULL
  AND user_id IN (SELECT user_id FROM amp_acquisition_contacts);
CREATE FUNCTION amp_suppress_acquisition_followup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM amp_acquisition_contacts WHERE user_id=NEW.user_id) THEN
    NEW.stopped_at := COALESCE(NEW.stopped_at,now());
    NEW.stopped_reason := COALESCE(NEW.stopped_reason,'founder-managed');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER amp_suppress_acquisition_followup BEFORE INSERT ON amp_parent_followup_outbox
  FOR EACH ROW EXECUTE FUNCTION amp_suppress_acquisition_followup();
