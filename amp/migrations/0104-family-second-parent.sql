-- A family's second parent (docs/families.md): the one adult besides the
-- account holder whom a paid family covers. She is a teacher of the family's
-- class through the ordinary staff invitation (a person with the teacher role
-- and a teacher enrollment), and this column says which person that is. Her
-- invitation is pending while the person has no account.
--
-- One column, so a family never has two. Inviting, accepting and removing
-- lock this row. The person belongs to the family's own tenant, so no person
-- is the second parent of two families.
ALTER TABLE amp_families
  ADD COLUMN second_parent uuid UNIQUE REFERENCES amp_people(id);

-- Who started a shared "Let … practice here" session on their own device: the
-- account holder or the second parent. Removing her ends the sessions she
-- started and leaves the rest.
ALTER TABLE amp_student_sessions ADD COLUMN started_by text;
