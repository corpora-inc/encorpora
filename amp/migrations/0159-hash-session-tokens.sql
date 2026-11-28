-- Account session tokens are stored as their SHA-256 (#2555,
-- src/server/session-tokens.ts), so a copy of the database holds no session
-- that works. Every API pod already finds a session by its hash (0157's
-- release); from this release new sessions are written that way, and these are
-- the ones written before. Nobody is signed out: the token in each browser is
-- unchanged, only what is stored. A row an older pod writes during the rollout
-- is hashed on its first use.
UPDATE amp_auth_sessions
   SET token = 'sha256:' || encode(sha256(convert_to(token, 'UTF8')), 'hex')
 WHERE token NOT LIKE 'sha256:%';

-- Provider tokens an older pod stored during 0157's rollout.
UPDATE amp_auth_accounts SET "accessToken" = NULL, "refreshToken" = NULL, "idToken" = NULL
 WHERE "accessToken" IS NOT NULL OR "refreshToken" IS NOT NULL OR "idToken" IS NOT NULL;
