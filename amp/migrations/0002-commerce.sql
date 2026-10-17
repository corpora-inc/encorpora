-- Admin-import ledger. Apply after 0001; migrations are tracked by the runner.
CREATE TABLE amp_commerce_ledger (
 id integer PRIMARY KEY CHECK (id = 1),
 state jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO amp_commerce_ledger(id,state) VALUES
 (1, '{"version":1,"orders":[],"grants":[],"events":[]}'::jsonb);

CREATE TABLE amp_commerce_events (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 channel text NOT NULL CHECK(channel IN ('pilot','stripe','apple','google','esa')),
 channel_reference text NOT NULL,
 event_id text NOT NULL,
 order_id text NOT NULL,
 payload jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(channel,channel_reference,event_id)
);
-- Corrections are additional events, never edits to original evidence.
CREATE FUNCTION amp_commerce_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Commerce event history is append-only';
END;
$$;
CREATE TRIGGER amp_commerce_events_immutable
 BEFORE UPDATE OR DELETE ON amp_commerce_events
 FOR EACH ROW EXECUTE FUNCTION amp_commerce_event_immutable();
