-- One student's grade for one class and period. An open term keeps only the
-- teacher's final here; its suggested range is computed on read. Closing a term
-- freezes the suggestion with the inputs it came from. Rows outlive a removed
-- student, whose person row stays as a tombstone: a registrar's record.
CREATE TABLE amp_term_grades (
  class_id uuid NOT NULL REFERENCES amp_classes(id),
  session_id uuid NOT NULL REFERENCES amp_academic_sessions(id),
  person_id uuid NOT NULL REFERENCES amp_people(id),
  suggested jsonb,
  final_value text CHECK(char_length(final_value) BETWEEN 1 AND 24),
  final_by uuid REFERENCES amp_people(id),
  final_at timestamptz,
  frozen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(class_id,session_id,person_id),
  CHECK(frozen_at IS NULL OR suggested IS NOT NULL)
);
CREATE INDEX amp_term_grades_person_idx ON amp_term_grades(person_id);
-- Whether a term is closed for a class, read on every gradebook request.
CREATE INDEX amp_term_grades_frozen_idx ON amp_term_grades(class_id,session_id) WHERE frozen_at IS NOT NULL;
