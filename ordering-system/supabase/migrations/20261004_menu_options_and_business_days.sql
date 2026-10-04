-- 2026-10-04 のまとめ変更
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている

-- 1. 「海苔佃煮」を「茎わかめ佃煮」に改名
--    （商品を作り直さず改名するので、過去の注文の明細も新しい名前で表示される）
UPDATE products SET name = '茎わかめ佃煮' WHERE name = '海苔佃煮';

-- 2. 曜日ごとの営業設定（0 = 日曜 … 6 = 土曜）
--    日付ごとの設定（takeout_schedule）があれば、そちらが優先される
CREATE TABLE IF NOT EXISTS business_hours_weekly (
  weekday    SMALLINT    PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  is_open    BOOLEAN     NOT NULL DEFAULT true,
  open_time  TEXT        NOT NULL DEFAULT '07:30',
  close_time TEXT        NOT NULL DEFAULT '14:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 管理画面（サーバー）からだけ読み書きする
ALTER TABLE business_hours_weekly ENABLE ROW LEVEL SECURITY;

-- これまでと同じ「毎日 7:30〜14:00 営業」で初期登録（登録済みの曜日は変えない）
INSERT INTO business_hours_weekly (weekday)
SELECT d FROM generate_series(0, 6) AS d
ON CONFLICT (weekday) DO NOTHING;

-- 3. おにぎりのオプション（とろろ昆布・漬け卵黄）の売り切れ状態
--    料金はプログラム側で管理する（とろろ昆布 +50円、漬け卵黄 +100円）
CREATE TABLE IF NOT EXISTS product_options (
  key         TEXT        PRIMARY KEY,
  is_sold_out BOOLEAN     NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;

INSERT INTO product_options (key) VALUES ('tororo'), ('egg_yolk')
ON CONFLICT (key) DO NOTHING;

-- 4. 注文明細に「漬け卵黄を追加」を記録する列
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS with_egg_yolk BOOLEAN NOT NULL DEFAULT false;

-- 5. テイクアウト限定の「おかずパック」（店内注文のメニューには出さない）
INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available)
SELECT 'おかずパック', 500, 'メイン1品・副菜3品', 'テイクアウト限定', 175, false, false
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'おかずパック');

-- 6. ランチプレートの説明文
UPDATE products SET description = '選べるおにぎり1個、メインおかず1品と副菜3品の盛り合わせ'
WHERE name = 'ランチプレート（おにぎり1個）';
UPDATE products SET description = '選べるおにぎり2個、メインおかず1品と副菜3品の盛り合わせ'
WHERE name = 'ランチプレート（おにぎり2個）';
