-- 2026-11-01 お弁当の写真
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 写真はアプリに同梱（public/products/）。デプロイ完了後に実行すること

UPDATE products SET image_url = '/products/orihaya-bento.webp', updated_at = now() WHERE name = '織はや弁当';
UPDATE products SET image_url = '/products/goka-orihaya-bento.webp', updated_at = now() WHERE name = '豪華織はや弁当';
