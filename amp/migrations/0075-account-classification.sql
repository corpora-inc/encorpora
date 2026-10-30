-- Operator-confirmed relationships are independent of payment or access rights.
CREATE TABLE amp_account_classification_events (
  user_id text NOT NULL REFERENCES amp_auth_users(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (length(btrim(event_key)) BETWEEN 1 AND 500),
  category text NOT NULL CHECK (category IN ('prospect','friends_family','internal')),
  note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 500),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,event_key)
);
CREATE TABLE amp_account_classifications (
  user_id text PRIMARY KEY REFERENCES amp_auth_users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('prospect','friends_family','internal')),
  note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);
