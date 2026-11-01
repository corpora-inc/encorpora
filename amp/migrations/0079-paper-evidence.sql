-- Paper results (src/workbook/results.ts) arrive as ordinary attempts with
-- `evidenceSource: "paper"` and an `evidenceWeight`. A typed answer checked by
-- the exact grader has weight 1 and counts like any answer. A parent's mark
-- without the answer has weight below 1: a "right" mark counts as practice,
-- not as independent evidence, and leaves the review schedule as it was; a
-- "not yet" mark is a miss. Attempts without a weight are unchanged.
CREATE OR REPLACE FUNCTION amp_project_skill_observation(p_learner text,p_outcome jsonb,p_sequence bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  previous jsonb;
  observation jsonb;
  recent jsonb;
  skill text := p_outcome->>'skillId';
  weight numeric := COALESCE((p_outcome->>'evidenceWeight')::numeric,1);
  correct boolean := (p_outcome->>'correct')::boolean;
  assisted boolean := (p_outcome->>'assisted')::boolean;
  independent boolean := correct AND NOT assisted AND weight>=1;
  partial boolean := correct AND NOT assisted AND weight<1;
  at_ms numeric := extract(epoch FROM (p_outcome->>'createdAt')::timestamptz)*1000;
  credited_at numeric;
  credits integer;
  attempts bigint;
  recent_correct integer;
  due numeric;
  intervals bigint[] := ARRAY[0,21600000,86400000,259200000,604800000,1209600000,2592000000]::bigint[];
BEGIN
  INSERT INTO amp_skill_evidence(learner_id,skill_id,state) VALUES(p_learner,skill,jsonb_build_object('version',1,'skillId',skill)) ON CONFLICT DO NOTHING;
  SELECT state INTO previous FROM amp_skill_evidence WHERE learner_id=p_learner AND skill_id=skill FOR UPDATE;
  observation := jsonb_build_object('ingestionSequence',p_sequence::text,'id',p_outcome->>'id','skillId',skill,'templateId',p_outcome->>'templateId',
    'correct',correct,'assisted',assisted,'createdAt',p_outcome->>'createdAt');
  IF weight<1 THEN observation := observation||jsonb_build_object('evidenceWeight',weight); END IF;
  SELECT jsonb_agg(value ORDER BY ordinality) INTO recent FROM (
    SELECT value,ordinality FROM jsonb_array_elements(COALESCE(previous->'recentOutcomes','[]'::jsonb)||jsonb_build_array(observation)) WITH ORDINALITY
    ORDER BY ordinality DESC LIMIT 5
  ) latest;
  SELECT count(*) INTO recent_correct FROM jsonb_array_elements(recent) v
    WHERE (v->>'correct')::boolean AND NOT (v->>'assisted')::boolean AND COALESCE((v->>'evidenceWeight')::numeric,1)>=1;
  attempts := COALESCE((previous->>'attempts')::bigint,0)+1;
  credits := COALESCE((previous->>'creditedRetrievals')::integer,0);
  credited_at := (previous->>'creditedAtMs')::numeric;
  IF partial THEN
    NULL;
  ELSIF NOT independent THEN
    credits := 0;
    credited_at := NULL;
  ELSIF credited_at IS NULL OR at_ms-credited_at>=21600000 THEN
    credits := LEAST(6,credits+1);
    credited_at := at_ms;
  END IF;
  due := CASE WHEN partial AND previous ? 'reviewDueAt' AND previous->>'reviewDueAt' IS NOT NULL
    THEN (previous->>'reviewDueAt')::numeric ELSE at_ms+intervals[credits+1] END;
  INSERT INTO amp_skill_evidence(learner_id,skill_id,state) VALUES(p_learner,skill,jsonb_build_object(
    'version',1,'skillId',skill,'attempts',attempts,
    'independentCorrect',COALESCE((previous->>'independentCorrect')::bigint,0)+CASE WHEN independent THEN 1 ELSE 0 END,
    'recentIndependentCorrect',recent_correct,
    'status',CASE WHEN independent AND attempts>=5 AND recent_correct>=4 THEN 'review-ready'
      WHEN partial AND previous->>'status'='review-ready' THEN 'review-ready' ELSE 'practicing' END,
    'lastPracticedAt',p_outcome->>'createdAt','recentOutcomes',recent,
    'latestIndependent',CASE WHEN independent THEN observation ELSE previous->'latestIndependent' END,
    'creditedRetrievals',credits,'creditedAtMs',credited_at,'reviewDueAt',due
  )) ON CONFLICT(learner_id,skill_id) DO UPDATE SET state=EXCLUDED.state;
END $$;
