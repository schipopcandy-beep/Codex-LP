# Google Cloud Run への移行手順

Vercel で動かしたまま Cloud Run を用意し、動作を確認してから LINE の URL を切り替える。
切り替えるまで、お客様・お店の使い方は何も変わらない。

- リージョン: `asia-northeast1`（東京。Supabase の ap-northeast-1 と同じ場所）
- サービス名: `orihaya`
- 設定ファイル: `ordering-system/Dockerfile`、`cloudbuild.yaml`（リポジトリ直下）

## ② Google Cloud のプロジェクトを作る

1. https://console.cloud.google.com を開き、お店用の Google アカウントでログイン
2. 上部のプロジェクト選択 →「新しいプロジェクト」→ 名前 `orihaya`
3. 「お支払い」でクレジットカードを登録（無料枠の範囲なら請求は 0 円）
4. 「お支払い」→「予算とアラート」で予算 1,000 円・50% / 90% / 100% で通知を作る
   （通知だけで、止まりはしない）

## ③ 自動デプロイの設定

1. 次の API を有効にする: Cloud Run / Cloud Build / Artifact Registry / Cloud Scheduler
2. Artifact Registry →「リポジトリを作成」: 名前 `orihaya`、形式 Docker、リージョン `asia-northeast1`
   - 「クリーンアップ ポリシー」で最新 3 個だけ残す（無料枠 0.5 GB を超えないように）
3. Cloud Build →「トリガー」→「リポジトリを接続」で GitHub の `schipopcandy-beep/Codex-LP` をつなぐ
4. 「トリガーを作成」
   - イベント: ブランチに push、ブランチ `^main$`
   - 構成: Cloud Build 構成ファイル `/cloudbuild.yaml`
   - 置換変数（Vercel の環境変数と同じ値。どれもブラウザから見える値）:
     - `_NEXT_PUBLIC_SUPABASE_URL`
     - `_NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `_NEXT_PUBLIC_LIFF_ID`
     - `_NEXT_PUBLIC_ORDER_LIFF_ID`
   - サービス アカウントに「Cloud Run 管理者」「サービス アカウント ユーザー」「Artifact Registry 書き込み」の権限を付ける
5. トリガーを「実行」して、最初のデプロイを作る
6. Cloud Run → `orihaya` →「新しいリビジョンの編集とデプロイ」→「変数とシークレット」に、
   Vercel と同じ値で次を入れる（秘密の値。GitHub には書かない）:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
   - `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` / `LINE_HARNESS_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_LIFF_ID` / `NEXT_PUBLIC_ORDER_LIFF_ID`
   - `CRON_SECRET` / `OPENWEATHERMAP_API_KEY`
   - `ADMIN_PASSWORD`（管理画面のパスワード。12文字以上）
   一度入れれば、以後の自動デプロイでも引き継がれる。

## ④ 定期実行（Vercel Cron の代わり）

Cloud Scheduler で 3 つ作る（無料は 3 ジョブまで）。タイムゾーンは「日本標準時」。

| 名前 | 頻度（JST） | URL | メソッド |
|---|---|---|---|
| weather-morning | `0 9 * * *` | `https://<Cloud Run のURL>/api/admin/weather` | GET |
| weather-night | `0 21 * * *` | `https://<Cloud Run のURL>/api/admin/weather` | GET |
| reset-sold-out | `0 0 * * *` | `https://<Cloud Run のURL>/api/cron/reset-sold-out` | GET |

3 つとも、HTTP ヘッダーに `Authorization: Bearer <CRON_SECRET と同じ値>` を付ける
（`/api/admin/...` は管理画面のログインが必要なため、定期実行はこのヘッダーで通す）。

## ⑤ 動作確認（Cloud Run の URL で）

- `/order?seat=...`（席の注文）・`/takeout`・`/vacancy`・`/order?wait=1` が開く
- `/admin` でログインでき、注文が見え、テスト注文が届く（音が鳴る）
- 売り切れ・店頭テイクアウト・順番待ちの操作ができる
- 失敗したときは Cloud Run →「ログ」を見る

## ⑥ 切り替え

LINE Developers で、URL の `https://codex-lp-k187.vercel.app` を Cloud Run の URL に変える:

- 店内注文の LIFF のエンドポイント: `<Cloud Run のURL>/order`
- テイクアウトの LIFF のエンドポイント: `<Cloud Run のURL>/takeout`
- Messaging API の Webhook URL: `<Cloud Run のURL>/api/line/webhook`（「検証」で成功を確認）

お店の端末のブックマーク（`/admin`）も変える。
席の QR コード・リッチメニュー（`liff.line.me` の URL）は変えなくてよい。

## ⑦ Vercel を止める

数日問題なければ、Vercel のプロジェクトを止める（Cron も一緒に止まる）。
止める前に戻したくなったら、⑥ の URL を Vercel のものに戻せばよい。
