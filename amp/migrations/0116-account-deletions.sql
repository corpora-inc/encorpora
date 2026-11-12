-- The journal of deleted accounts (src/account/delete-account.ts): one row per
-- deletion, so an operator can answer "was this account deleted, when, and
-- what went". It holds the account's opaque id and row counts per table,
-- never a name, an email address or anything a learner did. A dry run writes
-- nothing.
CREATE TABLE amp_account_deletions (
  id uuid PRIMARY KEY,
  account_id text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  -- 'self': the person, from Account; 'operator': scripts/delete-account.ts.
  via text NOT NULL CHECK (via IN ('self', 'operator')),
  -- {"table": {"deleted": n, "changed": n}, …}: changed rows stay,
  -- unlinked or withdrawn (a "Deleted learner" payment reference, a shared
  -- school's nameless tombstone).
  counts jsonb NOT NULL
);
CREATE INDEX amp_account_deletions_account_idx ON amp_account_deletions(account_id);
