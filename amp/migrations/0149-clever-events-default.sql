-- Events are on by default. A district that connected itself never turned them
-- on, so it synced once a day instead of every five minutes. No code path stored
-- an explicit opt-out before this migration (only `clever-sync.ts bind ...
-- events` ever wrote the column, and only to true), so every false row is the
-- old default. Disconnected rows are included: reconnecting turns Events on.
ALTER TABLE amp_clever_connections ALTER COLUMN events_enabled SET DEFAULT true;

-- events_baseline_at: the full snapshot the Events feed continues from. Its
-- watermark is event_cursor; a NULL cursor means the feed was empty when the
-- snapshot started, so the next Events run reads the feed from its start.
-- events_unavailable_at: Clever refused /events (401/403) since this time; the
-- connection falls back to the daily full snapshot and probes again each day.
ALTER TABLE amp_clever_connections
  ADD COLUMN IF NOT EXISTS events_baseline_at timestamptz,
  ADD COLUMN IF NOT EXISTS events_unavailable_at timestamptz;

UPDATE amp_clever_connections SET events_baseline_at=last_full_sync_at
  WHERE events_enabled AND event_cursor IS NOT NULL AND events_baseline_at IS NULL;
UPDATE amp_clever_connections SET events_enabled=true WHERE NOT events_enabled;
