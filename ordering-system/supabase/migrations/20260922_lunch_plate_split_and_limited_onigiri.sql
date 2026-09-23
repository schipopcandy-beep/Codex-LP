-- ランチプレートをおにぎり1個用・2個用に分割し、限定おにぎりを追加する
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 画像はアプリに同梱しているため image_url は相対パスで登録する
-- 何度実行しても同じ結果になるよう、重複登録しない書き方にしている

-- 1. 既存の「ランチプレート」があれば、おにぎり1個用に改名する
--    （過去の注文明細を壊さないよう、削除せず更新で対応）
UPDATE products
SET name       = 'ランチプレート（おにぎり1個）',
    price      = 1300,
    category   = 'ランチ',
    sort_order = 180
WHERE name = 'ランチプレート';

-- 2. おにぎり1個用（1. で改名されていなければ新規作成）
INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available)
SELECT 'ランチプレート（おにぎり1個）', 1300, '選べるおにぎり1個とおかずの盛り合わせ',
       'ランチ', 180, false, false
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'ランチプレート（おにぎり1個）');

-- 3. おにぎり2個用
INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available)
SELECT 'ランチプレート（おにぎり2個）', 1500, '選べるおにぎり2個とおかずの盛り合わせ',
       'ランチ', 181, false, false
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'ランチプレート（おにぎり2個）');

-- 4. 限定おにぎり（店内・テイクアウトの両方に表示される）
INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available)
SELECT '限定おにぎり', 600, '本日の具材はお席のチラシをご覧ください',
       'おにぎり', 165, false, true
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = '限定おにぎり');

-- 5. 商品画像を設定する
UPDATE products SET image_url = '/products/lunch-plate-1.webp'   WHERE name = 'ランチプレート（おにぎり1個）';
UPDATE products SET image_url = '/products/lunch-plate-2.webp'   WHERE name = 'ランチプレート（おにぎり2個）';
UPDATE products SET image_url = '/products/limited-onigiri.webp' WHERE name = '限定おにぎり';
