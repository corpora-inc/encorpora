-- Bounded reverse index probes for Family's history previews.
CREATE INDEX amp_grants_family_history_idx ON amp_grants(learner_id,starts_at DESC,id DESC);
CREATE INDEX amp_skill_days_latest_idx ON amp_skill_days(learner_id,day DESC) WHERE attempts>0;
CREATE INDEX amp_active_days_latest_idx ON amp_active_days(learner_id,day DESC) WHERE active_ms>0;
CREATE INDEX amp_family_approvals_class_history_idx ON amp_family_approvals(class_id,created_at,id);
