-- One parent signup receipt per account. Browser identifiers are short lived.
CREATE TABLE amp_ga_signup_exports (
  user_id text PRIMARY KEY REFERENCES amp_parent_followups(user_id) ON DELETE CASCADE,
  client_id text,
  session_id bigint,
  captured_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','accepted','rejected','uncertain','stopped')),
  dispatched_at timestamptz,
  http_status integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX amp_ga_signup_pending ON amp_ga_signup_exports(created_at) WHERE state='pending';

ALTER TABLE amp_funnel_events DROP CONSTRAINT amp_funnel_events_event_check;
ALTER TABLE amp_funnel_events ADD CONSTRAINT amp_funnel_events_event_check CHECK (event IN ('landing_view','try_click','placement_answer','placement_done','map_view','practice_answer','practice_skip','lesson_open','hint_use','mastery','email_saved','session_start','paywall_view','paywall_dismiss','plan_view','plan_select','checkout_start','checkout_return','purchase','learner_added','paid_practice_first','refund_requested','refund','level_check_view','purchase_attempt','purchase_action','trial_problem_view','auth_failure','page_view','problem_rendered','learning_request','client_error','account_session','auth_request'));
