-- The operator's alerts about a school's Clever or AnySchool request
-- (docs/clever-anyschool.md). A school's request needs a person to send
-- Clever's dashboard invitation; these rows are the mail that tells them.
-- `requested`, `reminder` (24 hours, the target) and `overdue` (72 hours, the
-- limit) go at most once per request; the worker derives them from the
-- request's age while it stays `requested`. `rerequested` is the school asking
-- again; at most one waits at a time. Delivery is a bounded worker pass, never
-- the request handler.
CREATE TABLE amp_school_request_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES amp_school_connection_requests(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('requested','rerequested','reminder','overdue')),
 created_at timestamptz NOT NULL DEFAULT now(),
 available_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 lease_until timestamptz,
 sent_at timestamptz,
 stopped_at timestamptz,
 stopped_reason text,
 last_error text
);
CREATE UNIQUE INDEX amp_school_request_alerts_once_idx ON amp_school_request_alerts(request_id,kind)
 WHERE kind<>'rerequested';
CREATE UNIQUE INDEX amp_school_request_alerts_waiting_idx ON amp_school_request_alerts(request_id)
 WHERE kind='rerequested' AND sent_at IS NULL AND stopped_at IS NULL;
CREATE INDEX amp_school_request_alerts_due_idx ON amp_school_request_alerts(available_at)
 WHERE sent_at IS NULL AND stopped_at IS NULL;
