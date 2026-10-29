-- Internal, authenticated journey evidence. Never exported to ad platforms.
CREATE TABLE amp_visitor_journeys (
  visitor_id uuid NOT NULL REFERENCES amp_funnel_visitors(visitor_id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  session_id uuid NOT NULL,
  account_id text,
  event text NOT NULL,
  props jsonb NOT NULL CHECK(jsonb_typeof(props)='object' AND octet_length(props::text)<=1024),
  client_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  PRIMARY KEY(visitor_id,event_id)
);
CREATE INDEX amp_visitor_journeys_account ON amp_visitor_journeys(account_id,client_at) WHERE account_id IS NOT NULL;
CREATE INDEX amp_visitor_journeys_received ON amp_visitor_journeys(received_at);
ALTER TABLE amp_funnel_events DROP CONSTRAINT amp_funnel_events_event_check;
ALTER TABLE amp_funnel_events ADD CONSTRAINT amp_funnel_events_event_check CHECK (event IN ('landing_view','try_click','placement_answer','placement_done','map_view','practice_answer','practice_skip','lesson_open','hint_use','mastery','email_saved','session_start','paywall_view','paywall_dismiss','plan_view','plan_select','checkout_start','checkout_return','purchase','learner_added','paid_practice_first','refund_requested','refund','level_check_view','purchase_attempt','purchase_action','trial_problem_view','auth_failure','page_view','problem_rendered','learning_request','client_error','account_session'));

-- Prevent queued browser retries from recreating erased account diagnostics.
CREATE TABLE amp_journey_generations(account_id text PRIMARY KEY, generation uuid NOT NULL);
