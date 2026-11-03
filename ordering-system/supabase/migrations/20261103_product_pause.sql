-- 2026-11-03 商品の長期の販売休止（管理画面の「売り切れ」から設定する）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
-- paused: 販売休止中か（夜中の売り切れリセットでは戻らない）
-- paused_until: 販売を再開する日（この日から自動で再開）。NULL なら再開日未定
ALTER TABLE products ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paused_until DATE;
