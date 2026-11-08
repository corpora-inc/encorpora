-- 0098 kept a child's roster name in step with their learner's name. That is
-- right for a family child, whose learner name is the source. A school
-- student's learner is named from the roster ("given family"), so the roster
-- stays the source there and the trigger leaves it alone.
CREATE OR REPLACE FUNCTION amp_roster_name_follows_learner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.name IS DISTINCT FROM OLD.name AND NEW.account_id NOT LIKE 'school:%' THEN
  UPDATE amp_people
     SET given_name = left(coalesce(nullif(btrim(NEW.name), ''), 'Student'), 100)
   WHERE learner_id = NEW.id AND given_name IS DISTINCT FROM left(coalesce(nullif(btrim(NEW.name), ''), 'Student'), 100);
 END IF;
 RETURN NEW;
END;
$$;
