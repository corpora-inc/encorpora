-- The free assessment's level check (every few problems): one more fixed
-- funnel event name. Its only prop is the problem count.
ALTER TABLE amp_funnel_events DROP CONSTRAINT amp_funnel_events_event_check;
ALTER TABLE amp_funnel_events ADD CONSTRAINT amp_funnel_events_event_check CHECK (event IN ('landing_view','try_click','placement_answer','placement_done','map_view','practice_answer','practice_skip','lesson_open','hint_use','mastery','email_saved','session_start','paywall_view','paywall_dismiss','plan_view','plan_select','checkout_start','checkout_return','purchase','learner_added','paid_practice_first','refund_requested','refund','level_check_view'));
