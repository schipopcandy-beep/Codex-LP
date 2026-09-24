-- 席からのお持ち帰り注文を、同じ伝票の中でイートインと区別できるようにする
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている

-- 1. 注文明細に「席からのお持ち帰り分」フラグを追加
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS is_takeout BOOLEAN NOT NULL DEFAULT false;

-- 2. 追加注文のステータス 'added' を許可する
--    （前回のマイグレーションを実行済みの場合も、そのまま流して問題ない）
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'added', 'preparing', 'served', 'paid'));
