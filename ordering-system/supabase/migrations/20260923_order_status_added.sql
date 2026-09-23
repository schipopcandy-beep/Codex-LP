-- 注文ステータスに「追加」（added）を追加する
--
-- 同じ席から追加注文が入った際、既存の伝票のステータスを 'added' にして
-- 厨房が追加分に気づけるようにする。
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'added', 'preparing', 'served', 'paid'));
