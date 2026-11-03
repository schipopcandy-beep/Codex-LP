-- 2026-11-03 限定おにぎりの商品名に【期間限定】を付ける
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run（デプロイ完了後）

UPDATE products SET name = '【期間限定】麻辣そぼろ卵黄', updated_at = now() WHERE name = '麻辣そぼろ卵黄';
