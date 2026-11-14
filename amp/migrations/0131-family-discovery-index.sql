-- migrate:concurrent-indexes
CREATE INDEX CONCURRENTLY amp_families_class_idx ON amp_families(class_id);
