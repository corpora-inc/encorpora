-- Activation milestones (docs/activation.md): the first time an account
-- reaches each step of its first run, written by the server where the step
-- happens, so no browser setting can drop it. One row per account and step;
-- a repeat is a no-op. Holds no names, learners or answers. Follows funnel
-- analytics retention (RETENTION.funnelEventDays), family export and
-- learning-data deletion, and goes with the account.
CREATE TABLE amp_activation_milestones (
  account_id text NOT NULL CHECK (account_id LIKE 'amp|%'),
  step text NOT NULL CHECK (step ~ '^[a-z][a-z0-9_]{1,39}$'),
  persona text CHECK (persona IN ('myself','parent','tutor','teacher','school')),
  first_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, step)
);
-- The weekly report reads one step over a date range.
CREATE INDEX amp_activation_milestones_step_idx ON amp_activation_milestones(step, first_at);

-- First-run screens and the ESA/EFA invoice form, step by step.
ALTER TABLE amp_funnel_events DROP CONSTRAINT amp_funnel_events_event_check;
ALTER TABLE amp_funnel_events ADD CONSTRAINT amp_funnel_events_event_check CHECK (event IN ('landing_view','try_click','placement_answer','placement_done','map_view','practice_answer','practice_skip','lesson_open','hint_use','mastery','email_saved','session_start','paywall_view','paywall_dismiss','plan_view','plan_select','checkout_start','checkout_return','purchase','learner_added','paid_practice_first','refund_requested','refund','level_check_view','purchase_attempt','purchase_action','trial_problem_view','auth_failure','page_view','problem_rendered','learning_request','client_error','external_runtime_error','account_session','auth_request','pitch_view','video_play','video_progress','buy_click','workbook_click','invite_view','video_seconds','first_interaction','pitch_buy_seen','starter_choice','allowance_pause_view','continue_click','setup_step','invoice_step'));

-- Accounts that started before this release: each milestone from the durable
-- record it already left (sign-up, learners, answers, workbooks, classes and
-- demos), demo orgs and simulated learners excluded. Their persona is the
-- earliest place they made. Funnel retention removes these as any other.
INSERT INTO amp_activation_milestones(account_id,step,persona,first_at)
WITH real_learner AS (
  SELECT l.id,l.account_id,l.adult,l.created_at FROM amp_learners l
  WHERE l.deleted_at IS NULL AND NOT l.simulation AND NOT EXISTS(
    SELECT 1 FROM amp_people p JOIN amp_orgs o ON o.id=p.tenant_id JOIN amp_orgs r ON r.id=o.path[1]
    WHERE p.learner_id=l.id AND r.demo)
), real_class AS (
  SELECT c.id,r.kind='family' AS family FROM amp_classes c
  JOIN amp_orgs o ON o.id=c.org_id JOIN amp_orgs r ON r.id=o.path[1] WHERE NOT r.demo
), teaching AS (
  SELECT t.account_id,k.id AS class_id,k.family,min(e.created_at) AS created_at FROM real_class k
  JOIN amp_enrollments e ON e.class_id=k.id AND e.role='teacher'
  JOIN amp_people t ON t.id=e.person_id AND t.account_id LIKE 'amp|%'
  GROUP BY 1,2,3
), class_student AS (
  SELECT e.class_id,e.created_at,l.id AS learner_id,l.account_id FROM amp_enrollments e
  JOIN amp_people p ON p.id=e.person_id JOIN real_learner l ON l.id=p.learner_id
  WHERE e.role='student' AND e.class_id IN (SELECT id FROM real_class)
), family_answer AS (
  SELECT l.account_id,a.id,a.created_at FROM real_learner l JOIN amp_attempts a ON a.learner_id=l.id
  WHERE l.account_id LIKE 'amp|%'
  UNION
  SELECT t.account_id,a.id,a.created_at FROM teaching t JOIN class_student s ON s.class_id=t.class_id
  JOIN amp_attempts a ON a.learner_id=s.learner_id WHERE t.family
), school_answer AS (
  SELECT DISTINCT t.account_id,a.id,a.created_at FROM teaching t JOIN class_student s ON s.class_id=t.class_id
  JOIN amp_attempts a ON a.learner_id=s.learner_id WHERE NOT t.family
), family_rank AS (
  SELECT account_id,created_at,row_number() OVER (PARTITION BY account_id ORDER BY created_at,id) AS n FROM family_answer
), school_rank AS (
  SELECT account_id,created_at,row_number() OVER (PARTITION BY account_id ORDER BY created_at,id) AS n FROM school_answer
), tutor_student AS (
  SELECT t.account_id,s.created_at FROM teaching t JOIN class_student s ON s.class_id=t.class_id
  WHERE t.family AND s.account_id LIKE 'school:%'
), evidence(account_id,step,persona,at) AS (
  SELECT 'amp|'||u.id,'account_created',NULL,u."createdAt" FROM amp_auth_users u
  UNION ALL SELECT account_id,'persona_chosen','teacher',created_at FROM amp_school_starts
  UNION ALL SELECT account_id,'persona_chosen',CASE WHEN admin THEN 'school' ELSE 'teacher' END,joined_at FROM amp_demo_visitors
  UNION ALL SELECT account_id,'demo_opened',NULL,joined_at FROM amp_demo_visitors
  UNION ALL SELECT account_id,'persona_chosen',CASE WHEN adult THEN 'myself' ELSE 'parent' END,created_at
    FROM real_learner WHERE account_id LIKE 'amp|%'
  UNION ALL SELECT account_id,'persona_chosen','tutor',created_at FROM tutor_student
  UNION ALL SELECT account_id,'learner_added',NULL,created_at FROM real_learner
    WHERE account_id LIKE 'amp|%' AND NOT adult
  UNION ALL SELECT account_id,'learner_added',NULL,created_at FROM tutor_student
  UNION ALL SELECT account_id,'first_answer',NULL,created_at FROM family_rank WHERE n=1
  UNION ALL SELECT account_id,'answers_20',NULL,created_at FROM family_rank WHERE n=20
  UNION ALL SELECT l.account_id,'workbook_opened',NULL,w.created_at FROM real_learner l
    JOIN amp_workbooks w ON w.learner_id=l.id WHERE l.account_id LIKE 'amp|%'
  UNION ALL SELECT t.account_id,'workbook_opened',NULL,w.created_at FROM teaching t
    JOIN class_student s ON s.class_id=t.class_id JOIN amp_workbooks w ON w.learner_id=s.learner_id WHERE t.family
  UNION ALL SELECT account_id,'class_created',NULL,created_at FROM teaching WHERE NOT family
  UNION ALL SELECT t.account_id,'student_joined',NULL,s.created_at FROM teaching t
    JOIN class_student s ON s.class_id=t.class_id WHERE NOT t.family
  UNION ALL SELECT account_id,'class_first_answer',NULL,created_at FROM school_rank WHERE n=1
  UNION ALL SELECT account_id,'class_answers_20',NULL,created_at FROM school_rank WHERE n=20
), first AS (
  SELECT account_id,step,min(at) AS at FROM evidence WHERE account_id LIKE 'amp|%' GROUP BY 1,2
), persona AS (
  SELECT DISTINCT ON (account_id) account_id,persona FROM evidence
  WHERE step='persona_chosen' ORDER BY account_id,at
)
SELECT f.account_id,f.step,p.persona,f.at FROM first f LEFT JOIN persona p USING (account_id)
ON CONFLICT (account_id,step) DO NOTHING;
