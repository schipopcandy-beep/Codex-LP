-- 2026-11-03 限定おにぎりを「麻辣そぼろ卵黄」に変更（名前と写真）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 写真はアプリに同梱（public/products/mala-soboro-ranou.webp）。デプロイ完了後に実行すること
-- 商品（id）はそのままなので、これまでの注文の記録や仕込み数・売り切れの設定は引き継がれる

UPDATE products SET name = '麻辣そぼろ卵黄', image_url = '/products/mala-soboro-ranou.webp', updated_at = now() WHERE name = '限定おにぎり';
