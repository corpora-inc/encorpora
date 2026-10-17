-- Stop commerce writers during deployment. The migration runner wraps this
-- cutover and its parity checks in one transaction; no dual-write window exists.
LOCK TABLE amp_commerce_ledger IN ACCESS EXCLUSIVE MODE;
LOCK TABLE amp_commerce_events IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE amp_commerce_orders (
 id text PRIMARY KEY,
 account_id text NOT NULL,
 learner_id text NOT NULL REFERENCES amp_learners(id),
 channel text NOT NULL CHECK(channel IN ('pilot','stripe','apple','google','esa')),
 channel_reference text NOT NULL,
 external_order_id text NOT NULL,
 order_state jsonb NOT NULL,
 grant_state jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(channel,channel_reference,external_order_id),
 CHECK ((order_state->>'id'=id AND order_state->'account'->>'id'=account_id
   AND order_state->'license'->>'accountId'=account_id
   AND order_state->'license'->>'learnerId'=learner_id
   AND order_state->>'channel'=channel
   AND order_state->>'channelReference'=channel_reference
   AND order_state->>'externalOrderId'=external_order_id) IS TRUE),
 CHECK (grant_state IS NULL OR ((grant_state->>'id'=id AND grant_state->>'orderId'=id
   AND grant_state->>'accountId'=account_id AND grant_state->>'learnerId'=learner_id
   AND grant_state->>'channel'=channel AND grant_state->>'externalOrderId'=external_order_id
   AND grant_state->>'sku'=order_state->'license'->>'sku'
   AND grant_state->>'startsAt'=order_state->'license'->>'startsAt'
   AND grant_state->>'endsAt'=order_state->'license'->>'endsAt') IS TRUE))
);
CREATE INDEX amp_commerce_orders_account_idx ON amp_commerce_orders(account_id,id);
CREATE INDEX amp_commerce_orders_learner_idx ON amp_commerce_orders(learner_id,id);
CREATE INDEX amp_commerce_events_order_idx ON amp_commerce_events(order_id,sequence);

DO $$
DECLARE old_state jsonb;
BEGIN
 SELECT state INTO STRICT old_state FROM amp_commerce_ledger WHERE id=1;
 IF old_state->>'version' IS DISTINCT FROM '1'
   OR jsonb_typeof(old_state->'orders') IS DISTINCT FROM 'array'
   OR jsonb_typeof(old_state->'grants') IS DISTINCT FROM 'array'
   OR jsonb_typeof(old_state->'events') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Unsupported commerce snapshot';
 END IF;
 INSERT INTO amp_commerce_orders(id,account_id,learner_id,channel,channel_reference,external_order_id,order_state,grant_state)
 SELECT o->>'id',o->'account'->>'id',o->'license'->>'learnerId',o->>'channel',o->>'channelReference',o->>'externalOrderId',o,g
 FROM jsonb_array_elements(old_state->'orders') o
 LEFT JOIN LATERAL jsonb_array_elements(old_state->'grants') g ON g->>'orderId'=o->>'id';

 IF (SELECT count(*) FROM amp_commerce_orders) <> jsonb_array_length(old_state->'orders')
 OR (SELECT count(*) FROM amp_commerce_orders WHERE grant_state IS NOT NULL) <> jsonb_array_length(old_state->'grants')
 OR EXISTS(SELECT 1 FROM amp_commerce_orders o JOIN amp_learners l ON l.id=o.learner_id WHERE l.account_id<>o.account_id)
 THEN RAISE EXCEPTION 'Commerce order/grant ownership parity failed'; END IF;

 -- Every replay entry must match the independently retained immutable payload.
 -- Bidirectional cardinality and keyed comparison detect omissions and changes.
 IF (SELECT count(*) FROM amp_commerce_events) <> jsonb_array_length(old_state->'events')
 OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(old_state->'events') e
   LEFT JOIN amp_commerce_events h ON h.channel=e->>'channel'
     AND h.channel_reference=e->>'channelReference' AND h.event_id=e->>'id'
   WHERE h.sequence IS NULL OR h.payload IS DISTINCT FROM (e->>'canonicalPayload')::jsonb
     OR h.order_id IS DISTINCT FROM h.payload->>'orderId'
     OR h.channel IS DISTINCT FROM h.payload->>'channel'
     OR h.channel_reference IS DISTINCT FROM h.payload->>'channelReference'
     OR h.event_id IS DISTINCT FROM h.payload->>'id'
 ) OR (SELECT count(DISTINCT (e->>'channel',e->>'channelReference',e->>'id'))
       FROM jsonb_array_elements(old_state->'events') e) <> jsonb_array_length(old_state->'events')
 THEN RAISE EXCEPTION 'Commerce event parity failed'; END IF;

 IF EXISTS (
   SELECT 1 FROM amp_commerce_orders o
   LEFT JOIN amp_grants g ON g.id='commerce:'||(o.grant_state->>'id')
   WHERE o.grant_state IS NOT NULL AND (
     g.id IS NULL OR g.learner_id IS DISTINCT FROM o.learner_id
     OR g.channel IS DISTINCT FROM o.channel
     OR g.external_order_id::jsonb IS DISTINCT FROM jsonb_build_array(o.channel_reference,o.external_order_id)
     OR g.status IS DISTINCT FROM o.grant_state->>'status'
     OR g.starts_at IS DISTINCT FROM greatest((o.grant_state->>'startsAt')::timestamptz,(o.grant_state->>'issuedAt')::timestamptz)
     OR g.ends_at IS DISTINCT FROM (o.grant_state->>'endsAt')::timestamptz
   )
 ) OR EXISTS (SELECT 1 FROM amp_grants g LEFT JOIN amp_commerce_orders o
   ON g.id='commerce:'||(o.grant_state->>'id') WHERE g.id LIKE 'commerce:%' AND o.id IS NULL)
 THEN RAISE EXCEPTION 'Commerce access projection parity failed'; END IF;
END;
$$;
ALTER TABLE amp_commerce_events ADD CONSTRAINT amp_commerce_events_order_fk
 FOREIGN KEY(order_id) REFERENCES amp_commerce_orders(id);
-- Old binaries fail closed instead of writing a second financial truth.
DROP TABLE amp_commerce_ledger;
