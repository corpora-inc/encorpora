-- The signed-out parent pitch at `/`: its funnel events, its engagement screen
-- and the sign-up intent each pitch path carries.
ALTER TABLE amp_funnel_events DROP CONSTRAINT amp_funnel_events_event_check;
ALTER TABLE amp_funnel_events ADD CONSTRAINT amp_funnel_events_event_check CHECK (event IN ('landing_view','try_click','placement_answer','placement_done','map_view','practice_answer','practice_skip','lesson_open','hint_use','mastery','email_saved','session_start','paywall_view','paywall_dismiss','plan_view','plan_select','checkout_start','checkout_return','purchase','learner_added','paid_practice_first','refund_requested','refund','level_check_view','purchase_attempt','purchase_action','trial_problem_view','auth_failure','page_view','problem_rendered','learning_request','client_error','account_session','auth_request','pitch_view','video_play','video_progress','buy_click','workbook_click'));

ALTER TABLE amp_engagement_pages DROP CONSTRAINT amp_engagement_pages_screen_check;
ALTER TABLE amp_engagement_pages ADD CONSTRAINT amp_engagement_pages_screen_check
  CHECK (screen IN ('home','pitch','pathways','assessment','practice','lesson','plans','checkout','invoice','funding','account','auth','other',
    'marketing_home','marketing_amp','marketing_ar','marketing_az','marketing_other'));

ALTER TABLE amp_parent_followups DROP CONSTRAINT amp_parent_followups_entry_label_check;
ALTER TABLE amp_parent_followups ADD CONSTRAINT amp_parent_followups_entry_label_check
  CHECK (entry_label IN ('openai-math-path','openai-math-plans','pitch-try','pitch-workbook','pitch-buy'));
