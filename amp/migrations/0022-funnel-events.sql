-- First-party funnel analytics (#1134). Generalises amp_trial_events: rows are
-- keyed by a random browser visitor ID that is never derived from, or stored
-- with, an account, learner, email or checkout. Retention: 90 days
-- (RETENTION.funnelEventDays); a converted visitor's events leave only
-- monthly aggregate counts.
CREATE TABLE amp_funnel_visitors (
  visitor_id uuid PRIMARY KEY,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  -- The trial's random analytics_id (amp_trials.analytics_id), never its token.
  trial_id uuid,
  utm_source text CHECK (utm_source ~ '^[a-z0-9._~-]{1,64}$'),
  utm_medium text CHECK (utm_medium ~ '^[a-z0-9._~-]{1,64}$'),
  utm_campaign text CHECK (utm_campaign ~ '^[a-z0-9._~-]{1,64}$'),
  referrer text CHECK (referrer IN ('direct','search','social','email','internal','other')),
  device text CHECK (device IN ('phone','tablet','desktop')),
  grade_band text CHECK (grade_band IN ('K','1','2','3','4','5','6','7','8','algebra-1','geometry','algebra-2')),
  age_band text CHECK (age_band IN ('under-6','6-8','9-11','12-14','15-plus')),
  converted_at timestamptz
);
CREATE INDEX amp_funnel_visitors_seen_idx ON amp_funnel_visitors(last_seen);
CREATE TABLE amp_funnel_events (
  id bigserial PRIMARY KEY,
  -- NULL only for a verified purchase or refund with no browser attribution.
  visitor_id uuid REFERENCES amp_funnel_visitors(visitor_id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('landing_view','try_click','placement_answer','placement_done','map_view','practice_answer','lesson_open','hint_use','mastery','email_saved','session_start','paywall_view','paywall_dismiss','plan_view','plan_select','checkout_start','checkout_return','purchase','learner_added','paid_practice_first','refund_requested','refund')),
  props jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(props)='object' AND octet_length(props::text)<=512),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_funnel_events_visitor_idx ON amp_funnel_events(visitor_id,occurred_at);
CREATE INDEX amp_funnel_events_time_idx ON amp_funnel_events(occurred_at);
-- Attribution for a verified purchase. The visitor is erased when the purchase
-- event is written (or after 90 days); the row then only makes the purchase
-- and first-refund events idempotent and goes with its checkout.
CREATE TABLE amp_funnel_checkouts (
  checkout_id uuid PRIMARY KEY REFERENCES amp_stripe_checkouts(id) ON DELETE CASCADE,
  visitor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  purchase_recorded_at timestamptz,
  refund_recorded_at timestamptz
);
CREATE INDEX amp_funnel_checkouts_created_idx ON amp_funnel_checkouts(created_at) WHERE visitor_id IS NOT NULL;
-- What remains of converted visitors' events after retention: counts only.
CREATE TABLE amp_funnel_aggregates (
  month date NOT NULL,
  event text NOT NULL,
  source text NOT NULL,
  device text NOT NULL,
  grade_band text NOT NULL,
  count integer NOT NULL CHECK (count>0),
  PRIMARY KEY (month,event,source,device,grade_band)
);
