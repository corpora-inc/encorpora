-- Birth years and starts in a legacy state (Q-56, Q-57). Read-only: every
-- statement is a SELECT, run in a read-only transaction. It prints learner and
-- account ids, years and dates, never names or addresses.
--
--   psql "$DATABASE_URL" -f amp/scripts/birth-year-report.sql
--
-- Nothing here is repaired automatically. A parent corrects a child's year in
-- Account → Learners (or setup's "Your children"); an adult corrects their
-- start in Account → Learners → Your practice.
BEGIN READ ONLY;

-- 1. An adult's own learner with no start: practice reads the scale's default
--    (grade 2) instead of an adult's mid-scale. Came from an adult trial moved
--    in before this change, or an older client that sent neither a year nor a
--    start. Repair, if approved (idempotent; the level is read again from the
--    same answers with the new start, nothing else changes):
--      UPDATE amp_learners SET starting_band='middle-school',starting_policy=1,
--        starting_excluded_strands='{}'::text[]
--      WHERE adult AND NOT simulation AND deleted_at IS NULL
--        AND starting_band IS NULL;
SELECT 'adult without a start' AS finding, l.account_id, l.id AS learner_id,
       l.created_at,
       (SELECT count(*) FROM amp_attempts a WHERE a.learner_id = l.id) AS answers
FROM amp_learners l
WHERE l.adult AND NOT l.simulation AND l.deleted_at IS NULL
  AND l.starting_band IS NULL
ORDER BY l.created_at;

-- 2. A trial moved into a family as a child of an account that also has its
--    own adult learner: the account holder may have tried AMP for themself
--    (the founder's 2016). Only the parent can say; they correct the year or
--    delete that learner's data in Account → Learners.
SELECT 'trial child beside own practice' AS finding, l.account_id,
       l.id AS learner_id, l.birth_year, l.label_number, t.adopted_at,
       (SELECT count(*) FROM amp_attempts a WHERE a.learner_id = l.id) AS answers
FROM amp_trials t
JOIN amp_learners l ON l.id = t.learner_id
WHERE t.adopted_by = l.account_id AND NOT l.adult AND l.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM amp_learners o WHERE o.account_id = l.account_id
              AND o.adult AND NOT o.simulation AND o.deleted_at IS NULL)
ORDER BY t.adopted_at;

-- 3. Children made in one request before 2026-11-10 share a creation time, so
--    they listed (and migration 0109 numbered them "Child 1", "Child 2") in
--    random id order, not the order the parent gave them. A parent who then
--    named "Child 1" as their first-born may have put each name on the other
--    child's year (Q-56). Each group is one family's tied children.
SELECT 'children created together' AS finding, l.account_id,
       l.created_at, array_agg(l.id ORDER BY l.label_number, l.id) AS learner_ids,
       array_agg(l.birth_year ORDER BY l.label_number, l.id) AS birth_years,
       array_agg(l.label_number ORDER BY l.label_number, l.id) AS labels,
       bool_or(l.name_basis IS NOT NULL) AS named_since
FROM amp_learners l
WHERE NOT l.adult AND l.deleted_at IS NULL AND l.account_id NOT LIKE 'school:%'
  AND l.account_id NOT LIKE 'trial:%'
GROUP BY l.account_id, l.created_at
HAVING count(*) > 1
ORDER BY l.created_at;

-- 4. A family's learner with an adult's year (19 or more): the old "Adult"
--    choice added a parent as a child of their own family. They sit on the
--    family class roster at grade 13 and start at the top of the scale.
SELECT 'adult year on a family learner' AS finding, l.account_id,
       l.id AS learner_id, l.birth_year, l.created_at,
       (SELECT count(*) FROM amp_attempts a WHERE a.learner_id = l.id) AS answers
FROM amp_learners l
WHERE NOT l.adult AND l.deleted_at IS NULL AND l.birth_year IS NOT NULL
  AND l.account_id NOT LIKE 'school:%' AND l.account_id NOT LIKE 'trial:%'
  AND l.birth_year <= extract(year FROM now())::int - 19
ORDER BY l.created_at;

-- 5. A family's child with no birth year: practice asks for it first on the
--    Overview, and the class shows no grade until the parent sets it.
SELECT 'family child without a year' AS finding, l.account_id,
       l.id AS learner_id, l.created_at
FROM amp_learners l
WHERE NOT l.adult AND l.deleted_at IS NULL AND l.birth_year IS NULL
  AND l.account_id NOT LIKE 'school:%' AND l.account_id NOT LIKE 'trial:%'
ORDER BY l.created_at;

-- 6. A family roster whose grade disagrees with the child's year (the year
--    changed through a path that didn't sync another family's class).
SELECT 'roster grade out of step' AS finding, l.account_id, l.id AS learner_id,
       l.birth_year, p.grade_level, p.tenant_id AS org_id
FROM amp_people p
JOIN amp_families f ON f.org_id = p.tenant_id
JOIN amp_learners l ON l.id = p.learner_id AND l.deleted_at IS NULL
WHERE l.birth_year IS NOT NULL
  AND p.grade_level IS DISTINCT FROM LEAST(13, GREATEST(0,
        (extract(year FROM now())::int
          - CASE WHEN extract(month FROM now()) < 8 THEN 1 ELSE 0 END)
        - l.birth_year - 7 + 1));

ROLLBACK;
