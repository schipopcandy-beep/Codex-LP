-- =============================================================
-- おにぎり注文システム DBスキーマ
-- Supabase SQL Editor に貼り付けて実行してください
-- =============================================================

-- 拡張: UUID生成
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- 1. tables（席マスタ）
-- =============================================================
CREATE TABLE IF NOT EXISTS tables (
  id         TEXT PRIMARY KEY,
  name       TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT true
);

-- =============================================================
-- 2. products（商品マスタ）
-- =============================================================
CREATE TABLE IF NOT EXISTS products (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  price             INTEGER     NOT NULL CHECK (price >= 0),
  description       TEXT,
  image_url         TEXT,
  category          TEXT        NOT NULL DEFAULT 'おにぎり',
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  is_sold_out       BOOLEAN     NOT NULL DEFAULT false,
  topping_available BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sort ON products (sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

-- =============================================================
-- 3. orders（伝票）
-- =============================================================
CREATE TABLE IF NOT EXISTS orders (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id   TEXT        NOT NULL REFERENCES tables (id),
  status     TEXT        NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'preparing', 'served', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_table_id  ON orders (table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- =============================================================
-- 4. order_items（注文明細）
-- =============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES products (id),
  quantity     INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   INTEGER     NOT NULL CHECK (unit_price >= 0),
  with_topping BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- =============================================================
-- RLS（Row Level Security）設定
-- ここでは開発用として全許可。本番時は適切に制限してください
-- =============================================================
ALTER TABLE tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- anon ユーザーに read 許可
CREATE POLICY "anon_read_tables"    ON tables      FOR SELECT USING (true);
CREATE POLICY "anon_read_products"  ON products    FOR SELECT USING (true);

-- service_role はすべて許可（APIルートで使用）
-- ※ Supabase では service_role は自動的にRLSをバイパスします

-- =============================================================
-- updated_at を自動更新するトリガー
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Realtime の有効化
-- Supabase ダッシュボードの Database > Replication でも設定が必要
-- =============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE orders;
-- ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
