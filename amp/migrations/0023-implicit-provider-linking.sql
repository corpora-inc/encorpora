-- Provider sign-in may link a provider identity to an existing parent whose
-- verified email matches the provider's verified email (Better Auth implicit
-- linking). Two kinds of parent keep that choice for themselves and must link
-- from Security instead: one who removed that exact identity, and one who
-- protects password sign-in with an authenticator. The check runs inside the
-- account INSERT under the parent row lock that also serializes removal.
CREATE TABLE amp_auth_removed_identities (
  "userId" text NOT NULL REFERENCES amp_auth_users (id) ON DELETE CASCADE,
  "providerId" text NOT NULL,
  "accountId" text NOT NULL,
  "removedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY ("userId", "providerId", "accountId")
);

CREATE OR REPLACE FUNCTION amp_require_link_session() RETURNS trigger LANGUAGE plpgsql AS $$
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
    -- An explicit link restores implicit sign-in for this identity.
    DELETE FROM amp_auth_removed_identities
      WHERE "userId" = NEW."userId" AND "providerId" = NEW."providerId"
        AND "accountId" = NEW."accountId";
  ELSIF NEW."providerId" <> 'credential' THEN
    -- Without an explicit link session, this is either a new parent's first
    -- identity (no prior row can match) or an implicit email-match link.
    PERFORM id FROM amp_auth_users WHERE id = NEW."userId" FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM amp_auth_users
        WHERE id = NEW."userId" AND "twoFactorEnabled" IS TRUE
    ) OR EXISTS (
      SELECT 1 FROM amp_auth_removed_identities
        WHERE "userId" = NEW."userId" AND "providerId" = NEW."providerId"
          AND "accountId" = NEW."accountId"
    ) THEN
      RAISE EXCEPTION 'Link this sign-in from Security' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
