-- 2026-10-14 茎わかめ佃煮の写真を差し替え
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 写真はアプリに同梱（public/products/kukiwakame-tsukudani.webp）。デプロイ完了後に実行すること

UPDATE products SET image_url = '/products/kukiwakame-tsukudani.webp', updated_at = now() WHERE name = '茎わかめ佃煮';
