-- 2026-10-18 同じ卓の複数名の注文で、おにぎりを注文者ごとに分ける（同じ人の分を1皿にまとめるため）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS diner_no SMALLINT;
