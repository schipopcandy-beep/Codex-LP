-- =============================================================
-- LINE連携テーブル・orders拡張
-- Supabase SQL Editor に貼り付けて実行してください
-- =============================================================

-- 1. line_users（LINEユーザー・友だち管理）
CREATE TABLE IF NOT EXISTS line_users (
  user_id     TEXT        PRIMARY KEY,
  is_friend   BOOLEAN     NOT NULL DEFAULT false,
  followed_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;
-- service_role のみ操作可（フロントから直接読み書き不可）

-- 2. orders に line_user_id カラムを追加
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS line_user_id TEXT REFERENCES line_users (user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_line_user_id ON orders (line_user_id);
