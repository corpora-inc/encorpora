-- ESA/EFA invoice funnel by program (docs/engagement-measurement.md#activation-milestones).
-- One read-only SELECT: counts only. Browsers come from the first-party
-- `invoice_step` events (staff and automated browsers excluded); invoices,
-- claims and payments come from the server's own records, which no browser
-- setting can drop.
--
--   psql "$AMP_DATABASE_URL" -f amp/scripts/invoice-funnel.sql
--
-- Rows: each program, each step in order, the browsers or invoices that
-- reached it in the last `days` days, and its share of the step it follows.
WITH params AS (
  SELECT 28 AS days
), steps(ord,step,source,prev) AS (
  -- `prev`: the step a share is taken of. The term is optional (a default
  -- is chosen), so the email is a share of the views; an error is a share
  -- of the submits.
  VALUES (1,'view','browser',NULL),(2,'term','browser',1),(3,'email','browser',1),
    (4,'student','browser',3),(5,'submit','browser',4),(6,'error','browser',5),
    (7,'success','browser',5),(8,'invoice created','server',5),
    (9,'claimed by an account','server',8),(10,'payment received','server',8)
), programs(program) AS (
  VALUES ('ar-efa'),('az-esa'),('nh-efa')
), browser AS (
  SELECT e.props->>'program' AS program,e.props->>'step' AS step,
    count(DISTINCT e.visitor_id)::int AS n
  FROM amp_funnel_events e CROSS JOIN params
  LEFT JOIN amp_funnel_visitors v ON v.visitor_id=e.visitor_id
  WHERE e.event='invoice_step' AND e.occurred_on>=current_date-params.days
    AND (v.traffic_kind IS NULL OR v.traffic_kind NOT IN ('internal','automated'))
  GROUP BY 1,2
), server AS (
  SELECT i.offer_snapshot->>'programId' AS program,s.step,count(*)::int AS n
  FROM amp_funding_invoice_intents i CROSS JOIN params
  CROSS JOIN LATERAL (VALUES
    ('invoice created',true),
    ('claimed by an account',i.state='claimed'),
    ('payment received',i.received_payment_at IS NOT NULL)) AS s(step,reached)
  WHERE i.created_at>=now()-make_interval(days=>params.days) AND s.reached
  GROUP BY 1,2
), reached AS (
  SELECT p.program,s.ord,s.step,s.source,s.prev,
    COALESCE(b.n,c.n,0) AS count
  FROM programs p CROSS JOIN steps s
  LEFT JOIN browser b ON s.source='browser' AND b.program=p.program AND b.step=s.step
  LEFT JOIN server c ON s.source='server' AND c.program=p.program AND c.step=s.step
)
SELECT r.program,r.ord,r.step,r.source,r.count,
  round(100.0*r.count/NULLIF(b.count,0),1) AS of_prev
FROM reached r LEFT JOIN reached b ON b.program=r.program AND b.ord=r.prev
ORDER BY r.program,r.ord;
