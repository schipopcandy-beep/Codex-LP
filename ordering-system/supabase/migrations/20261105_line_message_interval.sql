-- 2026-11-05 来店後のLINEメッセージ: 同じ人に送りすぎないルール
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run（何度実行しても同じ結果）
-- min_interval_days: このメッセージを送ってから、この日数のあいだは同じ人に送らない（NULL なら制限なし）
-- 来店のお礼は 30日（1か月に1回まで）にする
ALTER TABLE line_message_rules ADD COLUMN IF NOT EXISTS min_interval_days INTEGER CHECK (min_interval_days BETWEEN 1 AND 365); UPDATE line_message_rules SET min_interval_days = 30 WHERE key = 'thanks' AND min_interval_days IS NULL;
