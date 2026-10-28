-- 2026-10-28 管理画面からお客様に送ったLINEの記録（注文カードの「LINEで連絡」）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
-- ok: 送れたか（友だちでない・ブロックされている場合は false）
CREATE TABLE IF NOT EXISTS order_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE, text TEXT NOT NULL, ok BOOLEAN NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages (order_id); ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;
