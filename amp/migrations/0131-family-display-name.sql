-- Nullable metadata only: no table rewrite or data backfill under the DDL lock.
ALTER TABLE amp_family_spaces ADD COLUMN display_name text;
