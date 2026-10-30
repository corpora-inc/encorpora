-- Parent signup measurement is separate from purchases and learning activity.
CREATE TABLE amp_signup_browser_contexts (
  user_id text PRIMARY KEY REFERENCES amp_parent_followups(user_id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES amp_ad_click_evidence(id) ON DELETE CASCADE,
  user_agent text NOT NULL CHECK(length(user_agent) BETWEEN 1 AND 512),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days'
);
CREATE TABLE amp_provider_signup_exports (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES amp_parent_followups(user_id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('meta','openai')),
  destination_key text NOT NULL,
  evidence_id uuid NOT NULL REFERENCES amp_ad_click_evidence(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','retry','accepted','rejected','stopped')),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  receipt jsonb,
  http_status integer,
  stopped_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,provider)
);
CREATE INDEX amp_provider_signup_due ON amp_provider_signup_exports(available_at)
  WHERE state IN ('ready','retry');
