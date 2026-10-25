ALTER TABLE amp_funnel_visitors ADD COLUMN utm_content text
  CHECK (utm_content ~ '^[a-z0-9._~-]{1,64}$');

ALTER TABLE amp_engagement_pages DROP CONSTRAINT amp_engagement_pages_screen_check;
ALTER TABLE amp_engagement_pages ADD CONSTRAINT amp_engagement_pages_screen_check
  CHECK (screen IN ('home','pathways','assessment','practice','lesson','plans','checkout','invoice','funding','account','auth','other',
    'marketing_home','marketing_amp','marketing_ar','marketing_az','marketing_other'));

-- Existing pages have no known cross-document order. Only new arrivals get one.
CREATE SEQUENCE amp_engagement_visit_order;
ALTER TABLE amp_engagement_pages ADD COLUMN visit_order bigint;
ALTER TABLE amp_engagement_pages ALTER COLUMN visit_order SET DEFAULT nextval('amp_engagement_visit_order');
ALTER SEQUENCE amp_engagement_visit_order OWNED BY amp_engagement_pages.visit_order;
CREATE INDEX amp_engagement_visit_order_idx ON amp_engagement_pages(visitor_id,visit_order);

CREATE TABLE amp_journey_actions (
  visitor_id uuid NOT NULL REFERENCES amp_funnel_visitors(visitor_id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  occurred_on date NOT NULL,
  screen text NOT NULL CHECK (screen IN ('marketing_home','marketing_amp','marketing_ar','marketing_az','marketing_other')),
  action text NOT NULL CHECK (action IN ('invoice_open','invoice_close','assessment_click','product_click','support_click','funding_provider_click','navigation_click')),
  PRIMARY KEY (visitor_id,event_id)
);
CREATE INDEX amp_journey_actions_day_idx ON amp_journey_actions(occurred_on);
