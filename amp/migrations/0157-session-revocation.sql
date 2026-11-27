-- Incident containment (#2555, docs/incident-response.md).
--
-- One row per run of scripts/revoke-sessions.ts: the scope, the account or
-- org it named (an opaque id, never a name or email) and the counts. A dry run
-- writes nothing. Append-only, like amp_school_events; it is the operator's
-- record of what was ended, kept with the incident's other evidence.
CREATE TABLE amp_operator_events (
  id uuid PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('sessions.revoked')),
  scope text NOT NULL CHECK (scope IN ('account','org','all')),
  target_id text CHECK ((scope = 'all') = (target_id IS NULL)),
  detail jsonb NOT NULL DEFAULT '{}',
  "at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_operator_events_at_idx ON amp_operator_events("at" DESC);
CREATE FUNCTION amp_operator_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Operator event history is append-only';
END;
$$;
CREATE TRIGGER amp_operator_events_immutable
  BEFORE UPDATE OR DELETE ON amp_operator_events
  FOR EACH ROW EXECUTE FUNCTION amp_operator_event_immutable();

-- AMP signs in with a provider and never calls its API for the parent
-- afterwards, so it no longer stores the provider's tokens
-- (src/server/accounts.ts, `withoutProviderTokens`). The ones stored before go.
UPDATE amp_auth_accounts SET "accessToken" = NULL, "refreshToken" = NULL, "idToken" = NULL
 WHERE "accessToken" IS NOT NULL OR "refreshToken" IS NOT NULL OR "idToken" IS NOT NULL;
