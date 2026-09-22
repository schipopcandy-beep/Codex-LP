-- ランチプレートをおにぎり1個用・2個用の2商品に分割し、限定おにぎりを追加する
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 画像はアプリに同梱しているため、image_url は相対パスで登録する

-- 1. 既存の「ランチプレート」を「おにぎり1個」用に変更（過去の注文明細を壊さないため更新で対応）
UPDATE products
SET name        = 'ランチプレート（おにぎり1個）',
    price       = 1300,
    description = '選べるおにぎり1個とおかずの盛り合わせ',
    category    = 'ランチ',
    sort_order  = 180,
    image_url   = '/products/lunch-plate.webp'
WHERE name = 'ランチプレート';

-- 2. おにぎり2個用のランチプレートを追加
INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available, image_url)
VALUES (
  'ランチプレート（おにぎり2個）', 1500, '選べるおにぎり2個とおかずの盛り合わせ',
  'ランチ', 181, false, false, '/products/lunch-plate.webp'
)
ON CONFLICT DO NOTHING;

-- 3. 限定おにぎりを追加（店内・テイクアウトの両方に表示される）
INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available, image_url)
VALUES (
  '限定おにぎり', 600, '本日の具材はお席のチラシをご覧ください',
  'おにぎり', 165, false, true, '/products/limited-onigiri.webp'
)
ON CONFLICT DO NOTHING;
