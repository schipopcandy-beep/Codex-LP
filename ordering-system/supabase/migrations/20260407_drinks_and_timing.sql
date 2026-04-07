-- ドリンク商品を追加
INSERT INTO products (name, price, description, category, sort_order, is_sold_out, topping_available)
VALUES
  ('玉露入り緑茶',        300, NULL, 'ドリンク', 300, false, false),
  ('加賀ほうじ茶',        300, NULL, 'ドリンク', 310, false, false),
  ('アイスコーヒー',      300, NULL, 'ドリンク', 320, false, false),
  ('100%オレンジジュース', 300, NULL, 'ドリンク', 330, false, false),
  ('100%アップルジュース', 300, NULL, 'ドリンク', 340, false, false);

-- ドリンク提供タイミング（before / with / after）を order_items に追加
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS timing TEXT;

-- ランチプレート内おにぎりのプレート番号（0始まり）を追加
-- NULL = ランチプレート以外のアイテム
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS lunch_plate_index INTEGER;
