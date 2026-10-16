-- 2026-10-16 店頭テイクアウトでお客様の特徴（男性・メガネ など）を記録する列
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_features TEXT[];
