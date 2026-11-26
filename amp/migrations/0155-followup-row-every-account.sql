-- Every account has one follow-up row, whatever path made it (teacher sign-up
-- from /schools, invited adults, provider sign-ins that skipped the pitch).
-- New accounts get it from parent-followup/repository.ts
-- `ensureAccountFollowup`; this fills in the accounts made before. Each row is
-- opted in like a parent who left the default: US commercial email is opt-out
-- (CAN-SPAM, 15 U.S.C. 7704(a)(3)-(5)), met by the unsubscribe link and postal
-- address in every message. No program or campaign, a fresh random
-- unsubscribe token, and no outbox rows, so nothing is queued to send. The
-- acquisition contact comes from the 0072 trigger, as for any new account.
-- Safe to run again: only accounts without a row are touched.

-- A late intent can fill in a default row's program after its contact exists:
-- a contact still on the default time zone takes the campaign's.
CREATE OR REPLACE FUNCTION amp_enroll_acquisition_contact() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tz text;
BEGIN
  IF NEW.new_account THEN
    tz := CASE NEW.program WHEN 'ar-efa' THEN 'America/Chicago' WHEN 'az-esa' THEN 'America/Phoenix' ELSE 'America/New_York' END;
    INSERT INTO amp_acquisition_contacts(user_id,next_contact_at,time_zone,time_zone_basis)
      VALUES(NEW.user_id,COALESCE(NEW.verified_at,NEW.created_at),tz,
        CASE WHEN NEW.program IS NULL THEN 'default' ELSE 'campaign' END)
      ON CONFLICT(user_id) DO UPDATE SET
        next_contact_at=greatest(amp_acquisition_contacts.next_contact_at,excluded.next_contact_at),
        time_zone=CASE WHEN amp_acquisition_contacts.time_zone_basis='default' THEN excluded.time_zone ELSE amp_acquisition_contacts.time_zone END,
        time_zone_basis=CASE WHEN amp_acquisition_contacts.time_zone_basis='default' THEN excluded.time_zone_basis ELSE amp_acquisition_contacts.time_zone_basis END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS amp_enroll_acquisition_contact ON amp_parent_followups;
CREATE TRIGGER amp_enroll_acquisition_contact AFTER INSERT OR UPDATE OF verified_at,program ON amp_parent_followups
  FOR EACH ROW EXECUTE FUNCTION amp_enroll_acquisition_contact();

-- The backfill. created_at is the account's own sign-up time; verified_at is
-- set now for a confirmed address, as markSignupVerified would; signup_method
-- is the account's first sign-in method.
INSERT INTO amp_parent_followups(user_id,email,newsletter,notice_version,unsubscribe_token,new_account,created_at,verified_at,signup_method)
SELECT u.id,u.email,true,'account-default-v1',
  replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
  true,u."createdAt",CASE WHEN u."emailVerified" THEN now() END,
  (SELECT m.method FROM (
     SELECT CASE a."providerId" WHEN 'credential' THEN 'password' ELSE a."providerId" END AS method,a."createdAt" AS at
       FROM amp_auth_accounts a WHERE a."userId"=u.id
     UNION ALL
     SELECT 'passkey',k."createdAt" FROM amp_auth_passkeys k WHERE k."userId"=u.id
   ) m WHERE m.method IN ('google','microsoft','github','apple','password','passkey')
   ORDER BY m.at NULLS LAST LIMIT 1)
FROM amp_auth_users u
WHERE NOT EXISTS(SELECT 1 FROM amp_parent_followups p WHERE p.user_id=u.id)
ON CONFLICT(user_id) DO NOTHING;
