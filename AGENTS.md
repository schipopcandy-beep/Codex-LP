# AGENTS.md — 織はや 注文システム

AIエージェント（Codex・Claude Code など）への説明書です。作業を始める前に必ず全部読んでください。
人向けの運用手順は `ordering-system/docs/operations.md` にあります。

## このリポジトリは何か

仙台のおにぎり屋「織はや」の注文システムです。

- 店内注文：席のQRコードから注文する
- テイクアウト予約：LINEから注文する
- 順番待ち・空席状況
- 売り切れ管理と販売休止
- 来店後のLINEメッセージ
- 管理画面と売上分析

お店は営業中もこのシステムで動いています。**壊すと、その場で注文が止まります。**

| 場所 | 中身 |
|---|---|
| `ordering-system/` | Next.js 15（App Router）・TypeScript・Tailwind の本体 |
| `ordering-system/supabase/migrations/` | データベースの変更（SQL）。日付つきのファイル名 |
| `gas/orihaya.gs` | Googleスプレッドシートへの集計（GAS）。手で貼り付けて使う |
| `cloudbuild.yaml` | Cloud Run への自動デプロイの設定 |
| `ordering-system/docs/cloud-run.md` | Cloud Run の初期設定の記録 |

## 本番の構成

- **Cloud Run**（Google Cloud・東京）：`https://orihaya-1068118266163.asia-northeast1.run.app`
  - `main` にマージすると、Cloud Build のトリガー `deploy-main` が自動でデプロイする。約10分かかる。
- **Supabase**（PostgreSQL・東京）：サーバー側からだけ service role で読み書きする。Realtime は使っていない。
- **LINE**
  - LIFF：店内注文 `2009693463-xVibg5DN`（`/order`）、テイクアウト `2009693463-xC8UeRHb`（`/takeout`）
  - Messaging API で、注文の通知と来店後メッセージを push 送信する。
  - LINE の Webhook は外部サービスの LINE Harness が受け取る。このシステムに Webhook の入口はない。
- **Cloud Scheduler**（日本時間）：Bearer で `CRON_SECRET` を付けて、次の2つを呼ぶ。
  - `0 0 * * *` → `/api/cron/reset-sold-out`：今日の売り切れを戻す
  - `0 11 * * *` → `/api/cron/morning`：天気の記録と来店後メッセージの送信
  - 11時にやることを増やすときは、ジョブを増やさず `morning` に足す（無料枠が3ジョブまでのため）。
- **GAS**：毎日9時台に `refreshAll` でシートを更新するだけ。LINE は送らない。
- Vercel（`codex-lp-k187.vercel.app`）は旧環境で、停止予定。定時処理はもう動いていない。

## 必ず守るルール

1. **秘密の値は絶対に書かない。** トークン・キー・パスワードを、コード・コミット・PR・チャットに書かない。
   - 対象：`SUPABASE_SERVICE_ROLE_KEY`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`、`CRON_SECRET`、`ADMIN_PASSWORD`、`OPENWEATHERMAP_API_KEY` など
   - 値は Cloud Run の環境変数にだけ入っている。
   - `.env` 系のファイルはコミットしない。
2. **データベースを変えるとき**
   - `ordering-system/supabase/migrations/YYYYMMDD_内容.sql` を作る。
   - 何度実行しても同じ結果になるように書く（`IF NOT EXISTS`、`ON CONFLICT` など）。
   - 先頭に日本語のコメントで、何のための変更かと、実行方法（Supabase の SQL Editor に貼って Run）を書く。
   - お店の人に**SQLを実行してもらってから**マージする。ただし、SQLを実行する前でもコードが壊れない作りなら、先にマージしてよい。
3. **値段はサーバーで決める。** お客様の画面から届いた値段は使わず、`src/lib/order-pricing.ts` の `priceOrderItems` で付け直す。
   - 売り切れ・販売休止・お弁当の受け取り日のチェックも、サーバー側に必ず入れる。
4. **管理画面と管理用APIはログインが必要。** `src/middleware.ts` と `src/lib/admin-auth.ts` で守っている。
   - `/admin/*` と `/api/admin/*` 以外に、管理用の処理を置かない。
   - 定時処理の入口は `isCronRequest` で確かめる。
5. **データベースへの負担を増やさない。** 過去に Disk IO の上限と接続数の超過で、注文画面が重くなった。
   - 画面の取り直しは `usePolling` を使い、裏に回った画面では止める。
   - 管理画面の注文一覧は20秒ごと（音を鳴らすため、裏でも動かす）。
   - 一覧を取るときは期間を絞る（注文は直近3日など）。全件を読まない。
   - Supabase の Realtime は使わない。
6. **管理画面に絵文字を使わない。** イベント規模の「★」だけは例外。
7. 画面の文言・コメントは日本語で書く。お店の人が読んで分かる言葉にする。
8. `main` に直接 push しない。ブランチを切って PR を作る。

## 作業の流れ

```bash
cd ordering-system
npm ci
npx tsc --noEmit -p .    # 型チェック
npx next build           # ビルド（ここで失敗すると Cloud Run のデプロイも失敗する）
```

- テストのフレームワークはない。変更した画面は `npm run dev` で開いて確かめる。
- 本番のデータベースに接続しないと動かない画面が多い。秘密の値がない環境では、型チェックとビルドまでで十分。
- PR の説明は日本語で書く。何を・なぜ変えたかと、SQLの有無を書く。SQLがあるなら、PR に「マージ前に実行が必要」と書く。

## コードの地図

| やりたいこと | 見る場所 |
|---|---|
| 商品・値段・セット（ランチプレート・お弁当）の決まり | `src/lib/types.ts`（`isNigiriSet`、`getSetSurcharge`、`isBento`、`BENTO_LEAD_DAYS` など） |
| おすすめの表示 | `types.ts` の `LUNCH_PLATE_RECOMMENDATION`・`EATIN_SET`・`TAKEOUT_SET`・`LIMITED_ONIGIRI_NAMES`、`components/customer/RecommendedItem.tsx`（`RECOMMENDATIONS`）・`RecommendedSet.tsx` |
| 店内注文の画面 | `src/components/customer/OrderUI.tsx`、`src/app/api/orders/route.ts` |
| テイクアウトの画面 | `src/components/customer/TakeoutUI.tsx`・`TakeoutCart.tsx`、`src/app/api/takeout/orders/route.ts` |
| 値段の付け直し | `src/lib/order-pricing.ts` |
| 売り切れ・残り数 | `src/lib/stock.ts`、`src/app/api/admin/stock/route.ts`。管理画面の「売り切れまで」は残りの数で、サーバーが仕込み数に直す |
| 販売休止（期間つき） | `products.paused`・`paused_until`、`isPausedOn`・`isPausedToday` |
| 営業日・営業時間 | `src/lib/business-hours.ts` |
| 順番待ち | `src/lib/waitlist.ts`、`src/app/api/waitlist/`、`/admin/waitlist`、`/vacancy` |
| 席のQRコード | `types.ts` の `SEAT_TABLE_IDS`・`LEGACY_SEAT_CODES_ENABLED` |
| LINEの送信 | `src/lib/line-message.ts` |
| 来店後メッセージ | `src/lib/visit-messages.ts`、`/admin/messages`。テーブルは `line_message_rules`・`line_message_logs` |
| 天気 | `src/lib/weather.ts`（`/api/cron/morning` から呼ぶ） |
| 管理画面のログイン | `src/lib/admin-auth.ts`（パスワード12文字以上、ログインは30日間保持） |

商品の写真は `ordering-system/public/products/*.webp` に置き、`products.image_url` に `/products/…` を SQL で入れる。`/` で始まる画像は `unoptimized` で表示する。

## 過去に起きたことと対処

| 起きたこと | 原因と対処 |
|---|---|
| 注文画面・管理画面が重い、Disk IO の警告 | Realtime と取り直しの多さが原因。Realtime をやめ、取り直しを減らし、GAS を1日1回にした |
| コードから Realtime を消した後も Disk IO の警告（2026-11） | `order_items` が `supabase_realtime` の対象に残っていて、Realtime が WAL を読み続けていた。対象から外した（`20261127_stop_realtime_publication.sql`）。調べるときは `pg_stat_statements` を `shared_blks_read` の多い順に見る |
| 新しい写真が本番で表示されない | 画像の最適化の不具合。`/products` の画像は `unoptimized` にした |
| ランチのおすすめが出ない | 中身（漬け卵黄）が売り切れだった。候補を順に試すようにした |
| カードの中のボタンを押すと別の画面に飛ぶ | `<Link>` の中にボタンがあった。ボタンを `Link` の外に出した |
| 宣言より前に変数を使って画面が真っ白 | `const` の宣言順の問題（TDZ）。使う値の宣言より後ろに移した |

## 残っている課題

- LINE の ID トークンをサーバーで検証していない。今は LIFF から届いた `line_user_id` を信用している。
- 新しい席のQRコードを全席に貼り終えたら、`LEGACY_SEAT_CODES_ENABLED` を `false` にする。
- `waitlist.ts` の `TEMP_ACCEPT_UNTIL` は期限切れ（害はない）。`null` に戻してよい。
- Vercel のプロジェクトを止めて削除する（Git 連携を外す → 削除）。
- `ordering-system/README.md` は初期の内容で、古い（Vercel・Realtime の記述がある）。
