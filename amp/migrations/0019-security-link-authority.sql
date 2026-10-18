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

-- A proof obtained just before method removal must not issue a session after
-- removal commits. All authority fields are server-only and transient.
ALTER TABLE amp_auth_sessions
  ADD COLUMN "ampMethodKind" text,
  ADD COLUMN "ampMethodId" text,
  ADD COLUMN "ampMethodProvider" text;

CREATE FUNCTION amp_require_sign_in_method() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ampMethodKind" IS NOT NULL THEN
    PERFORM id FROM amp_auth_users WHERE id=NEW."userId" FOR UPDATE;
    IF NEW."ampMethodKind" = 'passkey' THEN
      PERFORM id FROM amp_auth_passkeys WHERE "userId"=NEW."userId"
        AND "credentialID"=NEW."ampMethodId" FOR KEY SHARE;
    ELSIF NEW."ampMethodKind" = 'provider' THEN
      PERFORM id FROM amp_auth_accounts WHERE "userId"=NEW."userId"
        AND "providerId"=NEW."ampMethodProvider" AND "accountId"=NEW."ampMethodId" FOR KEY SHARE;
    ELSE
      RAISE EXCEPTION 'This sign-in could not be verified' USING ERRCODE='42501';
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This sign-in method is no longer available' USING ERRCODE='42501';
    END IF;
  END IF;
  NEW."ampMethodKind" := NULL;
  NEW."ampMethodId" := NULL;
  NEW."ampMethodProvider" := NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER amp_session_method_authority BEFORE INSERT ON amp_auth_sessions
FOR EACH ROW EXECUTE FUNCTION amp_require_sign_in_method();
