-- 2026-11-01 テイクアウトのお弁当（織はや弁当・豪華織はや弁当）を追加
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
-- category 'お弁当' はテイクアウト予約の画面だけに出る（2日前までの予約。好きなおにぎり2個を選ぶ）
-- 写真は後から image_url を設定する

INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available) SELECT '織はや弁当', 1100, 'お好きなおにぎり2個＋唐揚げ・卵焼き', 'お弁当', 190, false, false WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = '織はや弁当'); INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available) SELECT '豪華織はや弁当', 3300, 'お好きなおにぎり2個＋贅沢おかずの詰め合わせ', 'お弁当', 191, false, false WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = '豪華織はや弁当');
