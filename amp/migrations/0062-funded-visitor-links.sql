-- Operational purchase correlation, kept separately from anonymous event rows.
-- No email, learner reference, provider credential, or billing name is copied.
CREATE TABLE amp_funded_visitor_links (
  request_id uuid PRIMARY KEY,
  visitor_id uuid REFERENCES amp_funnel_visitors(visitor_id) ON DELETE SET NULL,
  created_on date NOT NULL,
  entry_kind text NOT NULL CHECK(entry_kind IN ('guest_invoice','account_request')),
  document_kind text NOT NULL CHECK(document_kind IN ('invoice','quote')),
  program text NOT NULL,
  jurisdiction text NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
  currency text NOT NULL,
  submitted_on date,
  cancelled_on date
);
CREATE INDEX amp_funded_visitor_links_day_idx ON amp_funded_visitor_links(created_on);
CREATE INDEX amp_funded_visitor_links_visitor_idx ON amp_funded_visitor_links(visitor_id);

-- Preserve genuine historical invoice counts, without inventing browser/source
-- attribution or a timestamp for a parent's earlier status change.
INSERT INTO amp_funded_visitor_links
  (request_id,created_on,entry_kind,document_kind,program,jurisdiction,amount_minor,currency)
SELECT id,(created_at AT TIME ZONE 'UTC')::date,'guest_invoice','invoice',
  offer_snapshot->>'programId',offer_snapshot->>'jurisdiction',
  (offer_snapshot->>'subtotalMinor')::bigint+(offer_snapshot->>'taxMinor')::bigint,
  offer_snapshot->>'currency'
FROM amp_funding_invoice_intents WHERE created_at>now()-interval '90 days';
INSERT INTO amp_funded_visitor_links
  (request_id,created_on,entry_kind,document_kind,program,jurisdiction,amount_minor,currency)
SELECT id::uuid,(created_at AT TIME ZONE 'UTC')::date,'account_request',
  CASE WHEN offer_snapshot->>'documentPolicy'='named-student-invoice' THEN 'invoice' ELSE 'quote' END,
  offer_snapshot->>'programId',offer_snapshot->>'jurisdiction',
  (offer_snapshot->>'subtotalMinor')::bigint+(offer_snapshot->>'taxMinor')::bigint,
  offer_snapshot->>'currency'
FROM amp_funding_requests WHERE created_at>now()-interval '90 days'
  AND id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT(request_id) DO NOTHING;
