-- Applies only to funded rows (efa_order_id); card rows ignore this field.
-- The default preserves existing Arkansas identities and older worker inserts.
ALTER TABLE amp_meta_purchase_queue ADD COLUMN funded_program text NOT NULL
 DEFAULT 'ar-efa' CHECK(funded_program IN ('ar-efa','az-esa'));
