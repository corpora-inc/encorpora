-- The analytics identifier is random and cannot authenticate a trial.
ALTER TABLE amp_trials ADD COLUMN analytics_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE amp_trials ADD COLUMN teaching_template_id text;
ALTER TABLE amp_trials ADD COLUMN teaching_started_at timestamptz;
ALTER TABLE amp_trials ADD COLUMN teaching_material jsonb;
CREATE UNIQUE INDEX amp_trials_analytics_idx ON amp_trials(analytics_id);
CREATE TABLE amp_trial_events (
  trial_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('trial_started','placement_done','teaching_done','paywall','purchase')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trial_id,event)
);
-- Learning deletion removes the identity link; aggregate funnel events remain
-- under their unrelated random identifier, without any account/learner mapping.
CREATE FUNCTION amp_unlink_deleted_trial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM amp_trials WHERE learner_id=OLD.id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER amp_unlink_trial_delete BEFORE DELETE ON amp_learners
FOR EACH ROW EXECUTE FUNCTION amp_unlink_deleted_trial();
CREATE FUNCTION amp_unlink_tombstoned_trial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM amp_trials WHERE learner_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER amp_unlink_trial_tombstone BEFORE UPDATE OF deleted_at ON amp_learners
FOR EACH ROW EXECUTE FUNCTION amp_unlink_tombstoned_trial();
