-- migrate:concurrent-indexes
-- One level practice profile per account (0135).
CREATE UNIQUE INDEX CONCURRENTLY amp_learners_one_level_practice_idx ON amp_learners(account_id) WHERE level_practice IS NOT NULL AND deleted_at IS NULL;
