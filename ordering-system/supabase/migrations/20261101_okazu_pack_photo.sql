-- 2026-11-01 おかずパックの写真を差し替え
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 写真はアプリに同梱（public/products/okazu-pack.webp）。デプロイ完了後に実行すること

UPDATE products SET image_url = '/products/okazu-pack.webp', updated_at = now() WHERE name = 'おかずパック';
