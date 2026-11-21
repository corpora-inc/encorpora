-- The pilot interest list (/research/pilot): people who want to hear when the
-- pilot study opens enrolment. Not research data and not enrolment: no
-- learner names, answers or scores. One row per email address; signing up
-- again updates it. Deleting an AMP account with the same email removes it.
CREATE TABLE amp_research_pilot_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  role text NOT NULL CHECK (role IN ('parent','educator')),
  learners integer NOT NULL CHECK (learners BETWEEN 1 AND 100000),
  bands text[] NOT NULL,
  setting text NOT NULL CHECK (setting IN ('home','microschool','private','public')),
  place text NOT NULL,
  tests text[] NOT NULL,
  source text,
  news boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX amp_research_pilot_interest_email
  ON amp_research_pilot_interest (lower(email));
