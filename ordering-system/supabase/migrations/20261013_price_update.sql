-- 2026-10-13 おかか・茎わかめ佃煮・ほぐし梅を 350円 に変更
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 過去の注文は注文時の金額で記録されているため、影響しない

UPDATE products SET price = 350, updated_at = now() WHERE name IN ('おかか', '茎わかめ佃煮', 'ほぐし梅');
