-- Activation funnel by persona and sign-up week
-- (docs/engagement-measurement.md#activation-milestones). One read-only
-- SELECT over amp_activation_milestones: counts only, no account ids, names
-- or learners. Demo orgs never record a milestone; staff accounts marked
-- internal are left out here.
--
--   psql "$AMP_DATABASE_URL" -f amp/scripts/activation-funnel.sql
--
-- Rows: each sign-up week (Monday, UTC) and "all", each persona ("none":
-- signed up, never chose), each step of that persona's first run in order,
-- the accounts that reached it, and the share of the step before (`of_prev`)
-- and of sign-ups (`of_signups`), in percent. Change `weeks` to look further
-- back; milestones are kept 90 days.
WITH params AS (
  SELECT 8 AS weeks
), steps(persona,ord,step) AS (
  -- PERSONA_STEPS in src/analytics/activation.ts, in the same order.
  VALUES
    ('parent',1,'account_created'),('parent',2,'persona_chosen'),('parent',3,'learner_added'),
    ('parent',4,'first_answer'),('parent',5,'answers_20'),('parent',6,'workbook_opened'),
    ('tutor',1,'account_created'),('tutor',2,'persona_chosen'),('tutor',3,'learner_added'),
    ('tutor',4,'first_answer'),('tutor',5,'answers_20'),('tutor',6,'workbook_opened'),
    ('myself',1,'account_created'),('myself',2,'persona_chosen'),('myself',3,'first_answer'),
    ('myself',4,'answers_20'),
    ('teacher',1,'account_created'),('teacher',2,'persona_chosen'),('teacher',3,'class_created'),
    ('teacher',4,'student_joined'),('teacher',5,'class_first_answer'),('teacher',6,'class_answers_20'),
    ('school',1,'account_created'),('school',2,'persona_chosen'),('school',3,'demo_opened'),
    ('school',4,'school_created'),('school',5,'teacher_added'),
    ('none',1,'account_created'),('none',2,'persona_chosen')
), cohort AS (
  SELECT m.account_id,
    to_char(date_trunc('week',m.first_at AT TIME ZONE 'UTC'),'YYYY-MM-DD') AS week,
    COALESCE(c.persona,'none') AS persona
  FROM amp_activation_milestones m
  LEFT JOIN amp_activation_milestones c ON c.account_id=m.account_id AND c.step='persona_chosen'
  CROSS JOIN params
  WHERE m.step='account_created'
    AND m.first_at>=date_trunc('week',now() AT TIME ZONE 'UTC') - make_interval(weeks=>params.weeks-1)
    AND NOT EXISTS(SELECT 1 FROM amp_account_classifications k
      WHERE 'amp|'||k.user_id=m.account_id AND k.category='internal')
), reached AS (
  SELECT k.week,k.persona,s.ord,s.step,count(m.account_id)::int AS accounts
  FROM cohort k JOIN steps s ON s.persona=k.persona
  LEFT JOIN amp_activation_milestones m ON m.account_id=k.account_id AND m.step=s.step
  GROUP BY GROUPING SETS ((k.week,k.persona,s.ord,s.step),(k.persona,s.ord,s.step))
)
SELECT COALESCE(week,'all') AS week,persona,ord,step,accounts,
  round(100.0*accounts/NULLIF(lag(accounts) OVER w,0),1) AS of_prev,
  round(100.0*accounts/NULLIF(first_value(accounts) OVER w,0),1) AS of_signups
FROM reached
WINDOW w AS (PARTITION BY week,persona ORDER BY ord)
ORDER BY week IS NOT NULL,week DESC,
  array_position(ARRAY['parent','tutor','myself','teacher','school','none'],persona),ord;
