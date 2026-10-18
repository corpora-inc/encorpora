-- Transient server-only authority for an explicit OAuth link. The trigger
-- clears it before storage; existing account records need no backfill.
ALTER TABLE amp_auth_accounts ADD COLUMN "ampLinkSessionId" text;

CREATE FUNCTION amp_require_link_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ampLinkSessionId" IS NOT NULL THEN
    -- The same parent lock serializes sign-in method removal. Checking the
    -- initiating session inside the final INSERT also covers callbacks whose
    -- OAuth state was consumed before a removal revoked the session.
    PERFORM id FROM amp_auth_users WHERE id = NEW."userId" FOR UPDATE;
    PERFORM id FROM amp_auth_sessions
      WHERE id = NEW."ampLinkSessionId" AND "userId" = NEW."userId"
        AND "expiresAt" > clock_timestamp()
        AND "createdAt" > clock_timestamp() - interval '5 minutes'
      FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sign in again before linking an account' USING ERRCODE = '42501';
    END IF;
    NEW."ampLinkSessionId" := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER amp_account_link_authority BEFORE INSERT ON amp_auth_accounts
FOR EACH ROW EXECUTE FUNCTION amp_require_link_session();
