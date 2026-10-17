-- Stop learning writers during this transactional cutover. Existing attempt
-- facts are unchanged; sequence records historical chronological order followed
-- by future ingestion order, including equal-timestamp attempts.
LOCK TABLE amp_attempts IN ACCESS EXCLUSIVE MODE;
CREATE SEQUENCE amp_attempt_evidence_sequence;
ALTER TABLE amp_attempts ADD COLUMN evidence_sequence bigint;
WITH ranked AS (
  SELECT id,row_number() OVER(ORDER BY created_at,id) AS sequence FROM amp_attempts
) UPDATE amp_attempts a SET evidence_sequence=r.sequence FROM ranked r WHERE r.id=a.id;
SELECT setval('amp_attempt_evidence_sequence',COALESCE((SELECT max(evidence_sequence) FROM amp_attempts),0)+1,false);
ALTER TABLE amp_attempts ALTER COLUMN evidence_sequence SET NOT NULL;
ALTER SEQUENCE amp_attempt_evidence_sequence OWNED BY amp_attempts.evidence_sequence;
CREATE UNIQUE INDEX amp_attempt_evidence_sequence_idx ON amp_attempts(evidence_sequence);
CREATE INDEX amp_attempt_learner_evidence_idx ON amp_attempts(learner_id,evidence_sequence DESC);

CREATE TABLE amp_skill_evidence (
  learner_id text NOT NULL REFERENCES amp_learners(id) ON DELETE CASCADE,
  skill_id text NOT NULL,
  state jsonb NOT NULL,
  PRIMARY KEY(learner_id,skill_id),
  CHECK ((state->>'skillId'=skill_id AND state->>'version'='1') IS TRUE)
);

CREATE FUNCTION amp_project_skill_observation(p_learner text,p_outcome jsonb,p_sequence bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  previous jsonb;
  observation jsonb;
  recent jsonb;
  skill text := p_outcome->>'skillId';
  independent boolean := (p_outcome->>'correct')::boolean AND NOT (p_outcome->>'assisted')::boolean;
  at_ms numeric := extract(epoch FROM (p_outcome->>'createdAt')::timestamptz)*1000;
  credited_at numeric;
  credits integer;
  attempts bigint;
  recent_correct integer;
  intervals bigint[] := ARRAY[0,21600000,86400000,259200000,604800000,1209600000,2592000000]::bigint[];
BEGIN
  INSERT INTO amp_skill_evidence(learner_id,skill_id,state) VALUES(p_learner,skill,jsonb_build_object('version',1,'skillId',skill)) ON CONFLICT DO NOTHING;
  SELECT state INTO previous FROM amp_skill_evidence WHERE learner_id=p_learner AND skill_id=skill FOR UPDATE;
  observation := jsonb_build_object('ingestionSequence',p_sequence::text,'id',p_outcome->>'id','skillId',skill,'templateId',p_outcome->>'templateId',
    'correct',(p_outcome->>'correct')::boolean,'assisted',(p_outcome->>'assisted')::boolean,'createdAt',p_outcome->>'createdAt');
  SELECT jsonb_agg(value ORDER BY ordinality) INTO recent FROM (
    SELECT value,ordinality FROM jsonb_array_elements(COALESCE(previous->'recentOutcomes','[]'::jsonb)||jsonb_build_array(observation)) WITH ORDINALITY
    ORDER BY ordinality DESC LIMIT 5
  ) latest;
  SELECT count(*) INTO recent_correct FROM jsonb_array_elements(recent) v WHERE (v->>'correct')::boolean AND NOT (v->>'assisted')::boolean;
  attempts := COALESCE((previous->>'attempts')::bigint,0)+1;
  credits := COALESCE((previous->>'creditedRetrievals')::integer,0);
  credited_at := (previous->>'creditedAtMs')::numeric;
  IF NOT independent THEN
    credits := 0;
    credited_at := NULL;
  ELSIF credited_at IS NULL OR at_ms-credited_at>=21600000 THEN
    credits := LEAST(6,credits+1);
    credited_at := at_ms;
  END IF;
  INSERT INTO amp_skill_evidence(learner_id,skill_id,state) VALUES(p_learner,skill,jsonb_build_object(
    'version',1,'skillId',skill,'attempts',attempts,
    'independentCorrect',COALESCE((previous->>'independentCorrect')::bigint,0)+CASE WHEN independent THEN 1 ELSE 0 END,
    'recentIndependentCorrect',recent_correct,
    'status',CASE WHEN independent AND attempts>=5 AND recent_correct>=4 THEN 'review-ready' ELSE 'practicing' END,
    'lastPracticedAt',p_outcome->>'createdAt','recentOutcomes',recent,
    'latestIndependent',CASE WHEN independent THEN observation ELSE previous->'latestIndependent' END,
    'creditedRetrievals',credits,'creditedAtMs',credited_at,'reviewDueAt',at_ms+intervals[credits+1]
  )) ON CONFLICT(learner_id,skill_id) DO UPDATE SET state=EXCLUDED.state;
END $$;

-- A bounded-memory replay of retained facts, not reconstruction of missing history.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT learner_id,outcome,evidence_sequence FROM amp_attempts ORDER BY learner_id,outcome->>'skillId',evidence_sequence LOOP
    PERFORM amp_project_skill_observation(item.learner_id,item.outcome,item.evidence_sequence);
  END LOOP;
END $$;
CREATE FUNCTION amp_update_skill_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  PERFORM amp_project_skill_observation(NEW.learner_id,NEW.outcome,NEW.evidence_sequence);
  RETURN NEW;
END $$;
CREATE TRIGGER amp_attempt_skill_evidence AFTER INSERT ON amp_attempts
  FOR EACH ROW EXECUTE FUNCTION amp_update_skill_evidence();

-- Assign ingestion order only after acquiring the same learner lock used by
-- the API. Equal timestamps and concurrent direct inserts cannot reorder credit.
CREATE FUNCTION amp_order_skill_observation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  PERFORM 1 FROM amp_learners WHERE id=NEW.learner_id FOR NO KEY UPDATE;
  NEW.evidence_sequence := nextval('amp_attempt_evidence_sequence');
  RETURN NEW;
END $$;
CREATE TRIGGER amp_attempt_evidence_order BEFORE INSERT ON amp_attempts
  FOR EACH ROW EXECUTE FUNCTION amp_order_skill_observation();
