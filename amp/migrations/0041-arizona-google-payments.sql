-- Extend retained source identities without changing existing payment/export IDs.
ALTER TABLE amp_google_purchase_queue DROP CONSTRAINT amp_google_purchase_queue_source_kind_check;
ALTER TABLE amp_google_purchase_queue ADD CONSTRAINT amp_google_purchase_queue_source_kind_check CHECK(source_kind IN ('stripe','arkansas-efa','arizona-esa'));
ALTER TABLE amp_google_collection_cursors DROP CONSTRAINT amp_google_collection_cursors_kind_check;
ALTER TABLE amp_google_collection_cursors ADD CONSTRAINT amp_google_collection_cursors_kind_check CHECK(kind IN ('stripe','arkansas-efa','arizona-esa','delivery'));
