-- Practice authorization must find its one seat or source-owned role without
-- scanning every learner/membership in the district.
CREATE INDEX amp_seats_grant_idx ON amp_seats(grant_id) WHERE grant_id IS NOT NULL;
CREATE INDEX amp_clever_memberships_owned_local_idx
 ON amp_clever_memberships(kind,local_id) WHERE owned;
CREATE INDEX amp_pilot_extensions_pilot_until_idx ON amp_pilot_extensions(pilot_id,until_at DESC);
CREATE INDEX amp_school_purchase_requests_account_idx ON amp_school_purchase_requests(account_id,created_at DESC);

-- Recheck at activation, expiry and local-date boundaries. Roster mutations
-- reconcile immediately; periodic repair need not scan every seat each minute.
ALTER TABLE amp_school_licenses ADD COLUMN seats_checked_at timestamptz;
