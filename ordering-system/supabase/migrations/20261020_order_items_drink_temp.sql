-- 2026-10-20 緑茶・ほうじ茶のホット／アイスを記録する列
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS drink_temp TEXT;
