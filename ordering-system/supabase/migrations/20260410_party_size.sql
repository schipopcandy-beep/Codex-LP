-- 注文時の来店人数を保存
ALTER TABLE orders ADD COLUMN IF NOT EXISTS party_size INTEGER;
