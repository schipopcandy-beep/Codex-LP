-- 2026-10-15 おにぎりのオプション「大満足120%おにぎり」（+300円）を追加
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
-- 料金はプログラム側で管理する

-- 1. 注文明細に「大満足120%おにぎりにする」を記録する列
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS with_large BOOLEAN NOT NULL DEFAULT false;

-- 2. 売り切れ設定の行
INSERT INTO product_options (key) VALUES ('large') ON CONFLICT (key) DO NOTHING;
