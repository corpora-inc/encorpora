-- Trial ownership is separate from the consent-gated family learner account.
ALTER TABLE amp_trials ADD COLUMN owner_account_id text;
CREATE INDEX amp_trials_owner ON amp_trials(owner_account_id) WHERE adopted_at IS NULL;

ALTER TABLE amp_funnel_events DROP CONSTRAINT amp_funnel_events_event_check;
ALTER TABLE amp_funnel_events ADD CONSTRAINT amp_funnel_events_event_check CHECK (event IN ('landing_view','try_click','placement_answer','placement_done','map_view','practice_answer','practice_skip','lesson_open','hint_use','mastery','email_saved','session_start','paywall_view','paywall_dismiss','plan_view','plan_select','checkout_start','checkout_return','purchase','learner_added','paid_practice_first','refund_requested','refund','level_check_view','purchase_attempt','purchase_action','trial_problem_view','auth_failure'));
