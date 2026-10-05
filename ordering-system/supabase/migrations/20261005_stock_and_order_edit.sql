-- 2026-10-05 仕込み数（残り数の管理・自動売り切れ）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている

-- 日ごと・商品ごとの仕込み数。行がない商品は数を管理しない（従来どおり）
-- auto_sold_out: 残りが0になって自動で売り切れにしたか（注文の修正で残りが戻ったら販売中に戻すため）
-- ※コピー時に崩れないよう、表の定義の中にはコメントを書かない
CREATE TABLE IF NOT EXISTS product_stock (
  date          DATE        NOT NULL,
  product_id    UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  prepared_qty  INTEGER     NOT NULL CHECK (prepared_qty >= 0),
  auto_sold_out BOOLEAN     NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, product_id)
);
ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;
