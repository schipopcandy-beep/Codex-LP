-- 2026-10-12 店頭テイクアウトで、品目を決めずに数だけ入れる「テイクアウト（品目未指定）」を追加
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
-- 金額は ¥0。お客様のメニューや売り切れタブには出ない（カテゴリ「店頭入力用」）

INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available) SELECT 'テイクアウト（品目未指定）', 0, '店頭テイクアウトで品目を決めずに数だけ入れる用', '店頭入力用', 9999, false, false WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'テイクアウト（品目未指定）');
