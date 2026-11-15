-- Fixed categories for public curriculum and resource pages; no learner data.
ALTER TABLE amp_engagement_pages DROP CONSTRAINT amp_engagement_pages_screen_check;
ALTER TABLE amp_engagement_pages ADD CONSTRAINT amp_engagement_pages_screen_check
  CHECK (screen IN ('home', 'pitch', 'pathways', 'assessment', 'practice', 'lesson', 'plans', 'checkout', 'invoice', 'funding', 'account', 'auth', 'other', 'marketing_home', 'marketing_amp', 'marketing_ar', 'marketing_az', 'marketing_grades', 'marketing_workbooks', 'marketing_lessons', 'marketing_compare', 'marketing_approach', 'marketing_tutors', 'marketing_adults', 'marketing_plans', 'marketing_funding', 'marketing_resources', 'marketing_other'));

ALTER TABLE amp_journey_actions DROP CONSTRAINT amp_journey_actions_screen_check;
ALTER TABLE amp_journey_actions ADD CONSTRAINT amp_journey_actions_screen_check
  CHECK (screen IN ('marketing_home', 'marketing_amp', 'marketing_ar', 'marketing_az', 'marketing_grades', 'marketing_workbooks', 'marketing_lessons', 'marketing_compare', 'marketing_approach', 'marketing_tutors', 'marketing_adults', 'marketing_plans', 'marketing_funding', 'marketing_resources', 'marketing_other'));

ALTER TABLE amp_journey_actions DROP CONSTRAINT amp_journey_actions_action_check;
ALTER TABLE amp_journey_actions ADD CONSTRAINT amp_journey_actions_action_check
  CHECK (action IN ('invoice_open', 'invoice_close', 'assessment_click', 'product_click', 'support_click', 'funding_provider_click', 'navigation_click', 'workbook_download', 'video_play', 'video_complete'));
