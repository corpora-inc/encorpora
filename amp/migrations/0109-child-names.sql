-- Children's names (docs/parent-consent.md#childrens-names). A parent names
-- their own child, or leaves them their number in the family ("Child 2"); the
-- name's basis is recorded on the learner. A tutor's student goes by a
-- nickname or their number in the class's school ("Student 3") until their
-- own parent names them. Picture names ("Fox", "Moon 2") are retired: every
-- learner who had one goes by their number until someone names them.
-- `name_pending` keeps its meaning for learning: the child learns on the
-- restricted basis, without verified consent.
ALTER TABLE amp_learners
 DROP CONSTRAINT amp_learner_pending_identity,
 ADD COLUMN label_number integer CHECK (label_number IS NULL OR label_number > 0),
 ADD COLUMN name_basis text CHECK (name_basis IS NULL OR name_basis = 'parent_entry'),
 ADD COLUMN name_basis_version text,
 ADD COLUMN name_basis_at timestamptz,
 ADD CONSTRAINT amp_learner_name_basis CHECK (
   (name_basis IS NULL) = (name_basis_version IS NULL)
   AND (name_basis IS NULL) = (name_basis_at IS NULL));

-- Numbered in the order they were added, within the family or school.
WITH numbered AS (
 SELECT id, (row_number() OVER (PARTITION BY identity_scope ORDER BY created_at, id))::int AS n
 FROM amp_learners WHERE name_pending AND deleted_at IS NULL)
UPDATE amp_learners l SET
 label_number = numbered.n,
 name = CASE WHEN l.identity_scope LIKE 'school:%' THEN 'Student ' ELSE 'Child ' END || numbered.n,
 picture_identity = NULL,
 picture_number = NULL
FROM numbered WHERE l.id = numbered.id;

-- A school-owned student is named from their roster line, which follows here
-- (a family child's roster line follows by trigger, migration 0099).
UPDATE amp_people p SET given_name = l.name FROM amp_learners l
 WHERE p.learner_id = l.id AND l.name_pending AND l.account_id LIKE 'school:%'
   AND p.given_name IS DISTINCT FROM l.name;

ALTER TABLE amp_learners ADD CONSTRAINT amp_learner_pending_label CHECK (
 NOT name_pending OR (
   NOT adult AND birth_year IS NOT NULL AND deleted_at IS NULL
   AND identity_scope IS NOT NULL AND label_number IS NOT NULL));

CREATE UNIQUE INDEX amp_learner_label_unique
 ON amp_learners(identity_scope, label_number)
 WHERE label_number IS NOT NULL AND deleted_at IS NULL;
