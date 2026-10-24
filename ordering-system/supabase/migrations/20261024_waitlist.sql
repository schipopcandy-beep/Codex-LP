-- 2026-10-24 イートインの順番待ち（LINEから受付・番号札）
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる書き方にしている
--
-- status: waiting（待ち）/ called（呼び出し中）/ absent（呼び出したが不在）/ seated（案内済み）/ canceled（取り消し）
-- 不在のお客様が戻ったら、次に空いた席へ優先して案内する（returned_at に戻った時刻を入れる）
CREATE TABLE IF NOT EXISTS waitlist_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), date TEXT NOT NULL, number INTEGER NOT NULL, party_size SMALLINT NOT NULL CHECK (party_size BETWEEN 1 AND 20), status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'absent', 'seated', 'canceled')), line_user_id TEXT, display_name TEXT, token TEXT, notified_soon BOOLEAN NOT NULL DEFAULT false, returned_at TIMESTAMPTZ, called_at TIMESTAMPTZ, seated_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (date, number));
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_date ON waitlist_entries (date);
-- 管理画面（サーバー）からだけ読み書きする
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
