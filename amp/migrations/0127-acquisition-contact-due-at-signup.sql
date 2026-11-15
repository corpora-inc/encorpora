-- Minimum compliance: no law or email convention requires holding the first
-- contact until noon the next day (our own rule from #1746). The first contact
-- is due as soon as the signup is verified. CAN-SPAM's unsubscribe link and
-- postal address stay in every message.
CREATE OR REPLACE FUNCTION amp_enroll_acquisition_contact() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tz text;
BEGIN
  IF NEW.new_account THEN
    tz := CASE NEW.program WHEN 'ar-efa' THEN 'America/Chicago' WHEN 'az-esa' THEN 'America/Phoenix' ELSE 'America/New_York' END;
    INSERT INTO amp_acquisition_contacts(user_id,next_contact_at,time_zone,time_zone_basis)
      VALUES(NEW.user_id,COALESCE(NEW.verified_at,NEW.created_at),tz,
        CASE WHEN NEW.program IS NULL THEN 'default' ELSE 'campaign' END)
      ON CONFLICT(user_id) DO UPDATE SET next_contact_at=greatest(amp_acquisition_contacts.next_contact_at,excluded.next_contact_at);
  END IF;
  RETURN NEW;
END $$;

-- Contacts still waiting on the old noon hold, with nothing sent or drafted,
-- become due now.
UPDATE amp_acquisition_contacts c SET next_contact_at=now()
WHERE c.next_contact_at>now()
  AND NOT EXISTS(SELECT 1 FROM amp_acquisition_messages m WHERE m.user_id=c.user_id)
  AND NOT EXISTS(SELECT 1 FROM amp_acquisition_contact_events e WHERE e.user_id=c.user_id AND e.kind IN ('hold','release'));
