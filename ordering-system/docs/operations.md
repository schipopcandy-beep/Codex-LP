# 運用手順書（お店の人向け）

注文システムを直したり、設定を変えたりするときの手順です。
AI（Codex など）に頼むときの決まりは、リポジトリ直下の `AGENTS.md` に書いてあります。

## アドレス

| 用途 | URL |
|---|---|
| 管理画面 | `https://orihaya-1068118266163.asia-northeast1.run.app/admin` |
| 順番待ちの管理 | `https://orihaya-1068118266163.asia-northeast1.run.app/admin/waitlist` |
| お客様の空席状況・順番待ち | `https://orihaya-1068118266163.asia-northeast1.run.app/vacancy` |
| 店内注文（LIFF） | `https://liff.line.me/2009693463-xVibg5DN`（席のQRコードから） |
| テイクアウト（LIFF） | `https://liff.line.me/2009693463-xC8UeRHb` |

管理画面のパスワードは、口頭か紙で伝えます。チャットやメールには書かないでください。

## 使っているサービスと、そこでやること

| サービス | やること |
|---|---|
| GitHub（`schipopcandy-beep/Codex-LP`） | プログラムの置き場所。変更は PR → マージで反映 |
| Google Cloud（プロジェクト `orihaya`） | Cloud Run（本番）、Cloud Build（自動デプロイ）、Cloud Scheduler（0時・11時の定時処理） |
| Supabase | データベース。SQL の実行、テーブルの確認 |
| Google スプレッドシート（GAS） | 売上などの集計シート。毎日9時台に自動更新 |
| LINE Developers | LIFF とアクセストークンの設定 |
| LINE 公式アカウント | あいさつメッセージ、リッチメニュー、配信 |
| LINE Harness | LINE の Webhook を受け取るサービス |

## システムを直すとき（Codex に頼む流れ）

1. Codex に、やりたいことを日本語で伝える（例：「テイクアウトのおすすめを焼しゃけに変えて」）
2. Codex が変更して PR を作る
3. PR の説明を読む。**SQL の実行が必要と書いてあれば、先に Supabase で実行する**
   - Supabase → SQL Editor → 貼り付けて「Run」→「Success」になればOK
4. GitHub で PR を「Merge」する
5. 約10分で本番に反映される
   - Google Cloud → Cloud Build →「履歴」が緑のチェックなら成功
6. スマホや管理画面で、変わったかを確かめる

### うまくいかないとき

- **Cloud Build が赤（失敗）**：本番は前のままで動き続けます。Codex に失敗のログを見せて直してもらいます。
- **反映後に画面がおかしい**：GitHub でその PR を開き、「Revert」で元に戻す PR を作ってマージします。約10分で前の状態に戻ります。
- **エラーの内容を見たい**：Google Cloud → Cloud Run → `orihaya` →「ログ」を開きます。

## 秘密の値（パスワード・トークン）

- 秘密の値は Cloud Run → `orihaya` →「新しいリビジョンの編集とデプロイ」→ コンテナ →「変数とシークレット」にだけ入っています。
- 変えたいときは、そこで値を書き換えて「デプロイ」を押します。
- **GitHub・チャット・Codex には絶対に貼らないでください。**
- `ADMIN_PASSWORD` を変えると、全部の端末がログアウトします。12文字以上にしてください。

## 定時処理（Cloud Scheduler）

| 名前 | 時刻 | やること |
|---|---|---|
| `reset-sold-out` | 毎日 0:00 | 今日の売り切れを販売中に戻す |
| `morning` | 毎日 11:00 | 天気の記録と、来店後の LINE メッセージの送信 |

- 結果は Cloud Scheduler の一覧の「最後の実行」で見られます。
- `reset-sold-out` は、**営業中に「強制実行」しないでください。** その日の売り切れ表示が消えます。

## 管理画面でできること（プログラムを直さなくてよいもの）

- 商品の売り切れ、「売り切れまで」の残り数、期間を決めた販売休止
- テイクアウトの営業日と時間
- 順番待ちの呼び出し
- 来店後の LINE メッセージ（文面・画像・何日後に送るか・送る間隔）
- 売上分析

## お店の人を新しく追加するとき

それぞれのサービスで、本人のアカウントを招待します。パスワードの共有はしません。どのサービスも2段階認証をオンにしてもらいます。

| サービス | 招待の場所 |
|---|---|
| GitHub | リポジトリの Settings → Collaborators |
| Google Cloud | IAM（オーナーの方が招待） |
| Supabase | Organization → Team |
| スプレッドシート | 共有 →「編集者」 |
| LINE Developers | プロバイダー・チャネルの権限設定 |
| LINE 公式アカウント | 設定 → 権限 |
| LINE Harness | メンバー招待 |
