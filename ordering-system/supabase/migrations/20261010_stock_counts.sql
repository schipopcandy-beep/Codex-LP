-- 2026-10-10 仕込み数を「商品」以外の単位（ランチプレート合計・漬け卵黄）でも数えられるようにする
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
-- stock_key: "product:<商品ID>" / "group:lunch_plate"（1個用・2個用の合計）/ "option:egg_yolk"（漬け卵黄）
-- auto_sold_out: 残りが0になって自動で売り切れにしたか
-- ※コピー時に崩れないよう、1つの文を1行で書いている

CREATE TABLE IF NOT EXISTS stock_counts (date DATE NOT NULL, stock_key TEXT NOT NULL, prepared_qty INTEGER NOT NULL CHECK (prepared_qty >= 0), auto_sold_out BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (date, stock_key));
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;

-- これまでの「商品ごとの仕込み数」（product_stock）を引き継ぐ。ランチプレートの分は合計に移すため除く
INSERT INTO stock_counts (date, stock_key, prepared_qty, auto_sold_out, updated_at) SELECT s.date, 'product:' || s.product_id::text, s.prepared_qty, s.auto_sold_out, s.updated_at FROM product_stock s JOIN products p ON p.id = s.product_id WHERE p.name NOT LIKE 'ランチプレート%' ON CONFLICT (date, stock_key) DO NOTHING;
