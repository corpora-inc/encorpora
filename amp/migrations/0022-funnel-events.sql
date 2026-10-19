-- First-party funnel analytics (#1134). Generalises amp_trial_events: rows are
-- keyed by a random browser visitor ID that is never derived from, or stored
-- with, an account, learner, trial, email or checkout. Times are whole UTC
-- days, so they cannot be matched against billing timestamps. Retention: 90
-- days (RETENTION.funnelEventDays); a converted visitor's events leave only
-- monthly aggregate counts.
CREATE TABLE amp_funnel_visitors (
  visitor_id uuid PRIMARY KEY,
  first_seen date NOT NULL,
  last_seen date NOT NULL,
  utm_source text CHECK (utm_source ~ '^[a-z0-9._~-]{1,64}$'),
  utm_medium text CHECK (utm_medium ~ '^[a-z0-9._~-]{1,64}$'),
  utm_campaign text CHECK (utm_campaign ~ '^[a-z0-9._~-]{1,64}$'),
  referrer text CHECK (referrer IN ('direct','search','social','email','internal','other')),
  device text CHECK (device IN ('phone','tablet','desktop')),
  grade_band text CHECK (grade_band IN ('K','1','2','3','4','5','6','7','8','algebra-1','geometry','algebra-2')),
  age_band text CHECK (age_band IN ('under-6','6-8','9-11','12-14','15-plus')),
  converted_on date
);
CREATE INDEX amp_funnel_visitors_seen_idx ON amp_funnel_visitors(last_seen);
CREATE TABLE amp_funnel_events (
  id bigserial PRIMARY KEY,
  -- NULL only for a verified purchase or refund with no browser attribution.
  visitor_id uuid REFERENCES amp_funnel_visitors(visitor_id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('landing_view','try_click','placement_answer','placement_done','map_view','practice_answer','lesson_open','hint_use','mastery','email_saved','session_start','paywall_view','paywall_dismiss','plan_view','plan_select','checkout_start','checkout_return','purchase','learner_added','paid_practice_first','refund_requested','refund')),
  props jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(props)='object' AND octet_length(props::text)<=512),
  occurred_on date NOT NULL
);
CREATE INDEX amp_funnel_events_visitor_idx ON amp_funnel_events(visitor_id,id);
CREATE INDEX amp_funnel_events_day_idx ON amp_funnel_events(occurred_on);
-- Attribution for a verified purchase. The visitor is erased when the purchase
-- event is written (or 90 days after the checkout); the row then holds only
-- flags that keep the purchase and refund events idempotent, and goes with its
-- checkout. It has no timestamps to match against funnel rows.
CREATE TABLE amp_funnel_checkouts (
  checkout_id uuid PRIMARY KEY REFERENCES amp_stripe_checkouts(id) ON DELETE CASCADE,
  visitor_id uuid,
  purchase_recorded boolean NOT NULL DEFAULT false,
  refund_recorded boolean NOT NULL DEFAULT false,
  full_refund_recorded boolean NOT NULL DEFAULT false
);
CREATE INDEX amp_funnel_checkouts_linked_idx ON amp_funnel_checkouts(checkout_id) WHERE visitor_id IS NOT NULL;
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
