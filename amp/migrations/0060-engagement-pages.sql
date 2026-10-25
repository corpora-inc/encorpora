-- Legacy records stay unknown: they cannot retrospectively exclude staff/bots.
ALTER TABLE amp_funnel_visitors ADD COLUMN traffic_kind text NOT NULL DEFAULT 'unknown'
  CHECK (traffic_kind IN ('unknown','external','internal','automated'));
CREATE TABLE amp_engagement_pages (
  visitor_id uuid NOT NULL REFERENCES amp_funnel_visitors(visitor_id) ON DELETE CASCADE,
  page_id uuid NOT NULL,
  session_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 0 AND 100000),
  screen text NOT NULL CHECK (screen IN ('home','pathways','assessment','practice','lesson','plans','checkout','invoice','funding','account','auth','other')),
  occurred_on date NOT NULL,
  visible_ms integer NOT NULL CHECK (visible_ms BETWEEN 0 AND 86400000),
  active_ms integer NOT NULL CHECK (active_ms BETWEEN 0 AND visible_ms),
  PRIMARY KEY (visitor_id,page_id)
);
CREATE INDEX amp_engagement_pages_day_idx ON amp_engagement_pages(occurred_on);
CREATE INDEX amp_engagement_pages_session_idx ON amp_engagement_pages(visitor_id,session_id,ordinal);
