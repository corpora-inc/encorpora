ALTER TABLE amp_learners ADD COLUMN deleted_at timestamptz;
CREATE INDEX amp_learners_active_account_idx ON amp_learners(account_id,id) WHERE deleted_at IS NULL;
CREATE TABLE amp_privacy_events (
 id uuid PRIMARY KEY,
 account_id text NOT NULL,
 action text NOT NULL CHECK(action IN ('learner.renamed','learner.learning-deleted','account.learning-deleted','consent.withdrawn','export.started','export.completed')),
 learner_id text,
 affected_learners integer NOT NULL DEFAULT 0,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days'
);
CREATE INDEX amp_privacy_events_account_idx ON amp_privacy_events(account_id,occurred_at,id);
CREATE INDEX amp_privacy_events_expiry_idx ON amp_privacy_events(expires_at);
CREATE TABLE amp_export_tickets (
 digest text PRIMARY KEY,
 account_id text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '60 seconds'
);
CREATE INDEX amp_export_tickets_expiry_idx ON amp_export_tickets(expires_at);
