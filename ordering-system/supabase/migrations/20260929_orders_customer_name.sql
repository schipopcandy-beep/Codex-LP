-- テイクアウト注文のお客様名を保存する
--
-- LINEから注文した場合はLINEの表示名（お客様が変更可）、
-- 店頭で店員が入力した場合は入力した名前が入る。
-- 店内注文と一緒に頼んだお持ち帰り分には使わない。
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT;
