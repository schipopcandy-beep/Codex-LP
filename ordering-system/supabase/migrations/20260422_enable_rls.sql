-- RLS（Row-Level Security）を全テーブルで有効化
-- anon key での不正な書き込み・削除を防ぐ

ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables           ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeout_schedule ENABLE ROW LEVEL SECURITY;

-- products: 読み取りのみ許可（メニュー表示に必要）
CREATE POLICY "products_anon_select" ON products
  FOR SELECT TO anon USING (true);

-- tables: 読み取りのみ許可（座席バリデーションに使用）
CREATE POLICY "tables_anon_select" ON tables
  FOR SELECT TO anon USING (true);

-- takeout_schedule: 読み取りのみ許可（受取時間スロット表示に必要）
CREATE POLICY "takeout_schedule_anon_select" ON takeout_schedule
  FOR SELECT TO anon USING (true);

-- orders: 読み取りのみ許可（管理画面の Realtime postgres_changes に必要）
CREATE POLICY "orders_anon_select" ON orders
  FOR SELECT TO anon USING (true);

-- order_items: 読み取りのみ許可（同上）
CREATE POLICY "order_items_anon_select" ON order_items
  FOR SELECT TO anon USING (true);

-- line_users: anon アクセス不可（ポリシーなし = 拒否）
-- service_role は RLS をバイパスするため、既存の API ルートはすべて正常動作
