ALTER TABLE amp_learners
 ADD COLUMN name_pending boolean NOT NULL DEFAULT false,
 ADD COLUMN picture_identity text,
 ADD COLUMN picture_number integer,
 ADD COLUMN identity_scope text,
 ADD COLUMN free_online_used integer NOT NULL DEFAULT 0 CHECK (free_online_used BETWEEN 0 AND 100),
 ADD COLUMN free_workbooks_used integer NOT NULL DEFAULT 0 CHECK (free_workbooks_used BETWEEN 0 AND 5),
 ADD CONSTRAINT amp_learner_picture_identity CHECK (
   picture_identity IS NULL OR picture_identity IN
   ('fox','moon','turtle','umbrella','apple','owl','boat','frog','sun','whale','tree','bee','kite','rabbit','rocket','fish')),
 ADD CONSTRAINT amp_learner_picture_number CHECK (picture_number IS NULL OR picture_number > 0),
 ADD CONSTRAINT amp_learner_pending_identity CHECK (
   NOT name_pending OR (
     NOT adult AND birth_year IS NOT NULL AND deleted_at IS NULL
     AND picture_identity IS NOT NULL AND picture_number IS NOT NULL AND identity_scope IS NOT NULL
     AND name = initcap(picture_identity) || CASE WHEN picture_number=1 THEN '' ELSE ' ' || picture_number::text END
   ));

CREATE UNIQUE INDEX amp_learner_picture_identity_unique
 ON amp_learners(identity_scope,picture_identity,picture_number)
 WHERE picture_identity IS NOT NULL AND deleted_at IS NULL;

-- A trial keeps the same lifetime allowance when its learner changes owners.
-- Adoption retains its timestamp; later licensed practice is not free usage.
-- Retention may already have removed an adopted trial's metadata. Without
-- that boundary, the learner starts with a full allowance; historical paid
-- practice must not be guessed to be free usage.
UPDATE amp_learners l SET
 free_online_used=LEAST(100,
   (SELECT count(*) FROM amp_attempts a WHERE a.learner_id=l.id
     AND a.outcome->>'evidenceSource' IS DISTINCT FROM 'paper'
     AND (t.adopted_at IS NULL OR a.created_at<=t.adopted_at)) +
   (SELECT count(*) FROM amp_instances i WHERE i.learner_id=l.id AND i.content->>'skipped'='true'
     AND (t.adopted_at IS NULL OR
       COALESCE((i.content->>'skippedAt')::timestamptz,i.created_at)<=t.adopted_at))),
 free_workbooks_used=LEAST(5,
   (SELECT count(*) FROM amp_workbooks w WHERE w.learner_id=l.id
     AND (t.adopted_at IS NULL OR w.created_at<=t.adopted_at)))
 FROM amp_trials t WHERE t.learner_id=l.id;

-- Older roster writers cannot attach a name or contact details while the
-- learner is unnamed. Naming first requires an authorized learner transition.
CREATE FUNCTION amp_unnamed_roster_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE learner_name text;
BEGIN
 SELECT name INTO learner_name FROM amp_learners WHERE id=NEW.learner_id AND name_pending;
 IF FOUND AND (NEW.given_name IS DISTINCT FROM learner_name OR NEW.family_name IS NOT NULL
   OR NEW.display_name IS NOT NULL OR NEW.email IS NOT NULL OR NEW.identifier IS NOT NULL) THEN
   RAISE EXCEPTION 'An unnamed learner cannot have identifying roster fields' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER amp_unnamed_roster_identity BEFORE INSERT OR UPDATE ON amp_people
 FOR EACH ROW EXECUTE FUNCTION amp_unnamed_roster_identity();
