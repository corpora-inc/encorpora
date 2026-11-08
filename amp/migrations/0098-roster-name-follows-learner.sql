-- A child's roster name follows their learner's name, however the learner is
-- renamed (a parent in Family, an operator, a later screen). The family code
-- never writes roster tables itself.
CREATE FUNCTION amp_roster_name_follows_learner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.name IS DISTINCT FROM OLD.name THEN
  UPDATE amp_people
     SET given_name = left(coalesce(nullif(btrim(NEW.name), ''), 'Student'), 100)
   WHERE learner_id = NEW.id AND given_name IS DISTINCT FROM left(coalesce(nullif(btrim(NEW.name), ''), 'Student'), 100);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER amp_learners_roster_name
 AFTER UPDATE OF name ON amp_learners
 FOR EACH ROW EXECUTE FUNCTION amp_roster_name_follows_learner();
