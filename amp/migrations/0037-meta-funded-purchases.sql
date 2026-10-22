-- Share one delivery ledger across card payments and verified funded orders.
ALTER TABLE amp_meta_purchase_queue ALTER COLUMN payment_id DROP NOT NULL;
ALTER TABLE amp_meta_purchase_queue ADD COLUMN efa_order_id text UNIQUE REFERENCES amp_commerce_orders(id) ON DELETE CASCADE;
ALTER TABLE amp_meta_purchase_queue ADD CONSTRAINT amp_meta_one_payment_source CHECK(num_nonnulls(payment_id,efa_order_id)=1);
