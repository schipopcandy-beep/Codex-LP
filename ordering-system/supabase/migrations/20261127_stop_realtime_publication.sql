-- 2026-11-27 Realtime（データベースの変更を見張る仕組み）を止める
--
-- システムはもう Realtime を使っていない（画面は一定時間ごとの取り直しだけ）。
-- それでも表が Realtime の対象に入っていると、変更の記録（WAL）を読み続けて
-- データベースの読み書きの予算（Disk IO）を使ってしまうため、対象から外す。
--
-- 実行方法: Supabase ダッシュボード → SQL Editor に貼り付けて Run
-- 何度実行しても同じ結果になる（対象の表がなければ何もしない）
do $$ declare r record; begin for r in select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' loop execute format('alter publication supabase_realtime drop table %I.%I', r.schemaname, r.tablename); end loop; end $$;
