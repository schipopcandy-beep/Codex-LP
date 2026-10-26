-- 2026-10-27 順番待ちで希望の席（テーブル席・カウンター・どちらでもよい）を選べるようにする
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
-- seat_preference: table（テーブル席）/ counter（カウンター）/ any（どちらでもよい）。今までの受付は any になる
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS seat_preference TEXT NOT NULL DEFAULT 'any' CHECK (seat_preference IN ('table', 'counter', 'any'));
