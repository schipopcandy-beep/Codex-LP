# 織はや 注文システム 引き継ぎ資料

## システム概要

岡山のおにぎり屋「織はや」向けの注文管理システム。
- **イートイン**：QRコードで席のURLにアクセス → LINEログイン → 注文
- **テイクアウト**：LINEのリッチメニュー等からアクセス → LINEログイン → 受取日時選択 → 注文 → LINE通知

---

## 技術スタック

- **フレームワーク**: Next.js 15 App Router（TypeScript）
- **スタイル**: Tailwind CSS（カスタムカラー: brown, cream, matcha）
- **DB / Auth**: Supabase（PostgreSQL + Realtime + Storage）
- **認証**: LINE LIFF SDK（`@line/liff`）
- **通知**: LINE Messaging API Push Message
- **デプロイ**: Vercel（main ブランチへのマージで自動デプロイ）

---

## 重要な識別情報

| 項目 | 値 |
|---|---|
| Supabase プロジェクトRef | `wgjfwjourukgtxpkuaup` |
| Supabase URL | `https://wgjfwjourukgtxpkuaup.supabase.co` |
| GitHub リポジトリ | `schipopcandy-beep/Codex-LP` |
| 作業ブランチ | `claude/merge-ordering-system-Z2qV0` |
| アプリディレクトリ | `ordering-system/` |

---

## 画面構成

### 顧客向け画面

| URL | 画面 | 説明 |
|---|---|---|
| `/table/[tableId]` | イートイン注文 | QRコードからアクセス。tableId = `table-1`〜`table-4`, `counter-1`〜`counter-4` |
| `/table/[tableId]/complete` | イートイン注文完了 | 注文確定後の完了画面 |
| `/takeout` | テイクアウト注文 | LINEリッチメニューからアクセス。ランチプレートは非表示 |
| `/takeout/complete` | テイクアウト注文完了 | 受取日時・注文番号を表示 |

**QRコード → tableId 変換**（URLパラメータ `?seat=t1` 等）:
- `t1`→`table-1`, `t2`→`table-2`, `t3`→`table-3`, `t4`→`table-4`
- `c1`→`counter-1`, `c2`→`counter-2`, `c3`→`counter-3`, `c4`→`counter-4`

### 管理画面

| URL | 画面 | 説明 |
|---|---|---|
| `/admin` | 注文一覧 | 未会計の注文一覧。タブ: すべて / イートイン / テイクアウト。Realtime自動更新・通知音あり |
| `/admin/orders/[orderId]` | 注文詳細 | ステータス変更（新規→調理中→準備済み/提供済み）・会計済みボタン |
| `/admin/takeout-schedule` | 受取日時設定 | テイクアウトの受付時間を日ごとに設定（開放/閉鎖・開始・終了時間） |
| `/admin/products` | 商品管理 | 売り切れ切り替え（is_sold_out） |
| `/admin/analytics` | 売上分析 | 売上集計 |

---

## DB スキーマ（Supabase）

```sql
-- 席マスタ
tables (id TEXT PK, name TEXT, is_active BOOLEAN)
-- 席ID一覧: table-1〜4, counter-1〜4, takeout

-- 商品マスタ
products (id UUID PK, name TEXT, price INT, description TEXT,
          image_url TEXT, category TEXT, sort_order INT,
          is_sold_out BOOLEAN, topping_available BOOLEAN)
-- カテゴリ: 'おにぎり' | 'ドリンク' | 'その他'

-- 注文伝票
orders (id UUID PK, table_id TEXT FK, status TEXT,
        pickup_at TEXT,   -- "YYYY-MM-DD HH:MM"（テイクアウトのみ）
        line_user_id TEXT FK,
        created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
-- status: 'new' | 'preparing' | 'served' | 'paid'

-- 注文明細
order_items (id UUID PK, order_id UUID FK, product_id UUID FK,
             quantity INT, unit_price INT, with_topping BOOLEAN,
             timing TEXT,              -- ドリンク提供タイミング: 'before'|'with'|'after'
             lunch_plate_index INT,    -- ランチプレート内おにぎり番号（nullは通常アイテム）
             created_at TIMESTAMPTZ)

-- LINE ユーザー
line_users (user_id TEXT PK, display_name TEXT, is_friend BOOLEAN,
            updated_at TIMESTAMPTZ)

-- テイクアウト受付スケジュール
takeout_schedule (date TEXT PK,  -- "YYYY-MM-DD"
                  is_open BOOLEAN, open_time TEXT, close_time TEXT)
```

**RLS 設定**（有効化済み）:
- `products`, `tables`, `takeout_schedule`, `orders`, `order_items` → anon SELECT のみ許可
- `line_users` → anon アクセス不可
- 書き込みはすべて service_role（APIルート経由）で実行

---

## API ルート

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/products` | 商品一覧（anon可） |
| POST | `/api/orders` | イートイン注文作成（service role） |
| GET/PATCH | `/api/orders/[orderId]` | 注文取得・ステータス更新 |
| GET | `/api/admin/orders` | 管理用 未会計注文一覧（service role） |
| POST | `/api/takeout/orders` | テイクアウト注文作成 + LINE通知送信 |
| GET | `/api/takeout/schedule` | 受取可能スロット一覧（今日含む8日分） |
| GET/POST | `/api/admin/takeout-schedule` | 受付スケジュール取得・更新 |
| PATCH | `/api/admin/products/[productId]` | 売り切れ切り替え |
| GET | `/api/admin/analytics` | 売上分析データ |
| POST | `/api/line/webhook` | LINE Webhook（友だち追加/削除） |
| GET | `/api/line/friend-status` | LINE友だち状態確認 |

---

## 環境変数（Vercel に設定済み）

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_LIFF_ID            # LINE LIFF ID（例: 2009693463-xC8UeRHb）
NEXT_PUBLIC_LINE_ADD_FRIEND_URL
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
```

---

## 主要ファイルマップ

```
ordering-system/src/
├── lib/
│   ├── types.ts                    # 型定義・定数・ユーティリティ関数（中心ファイル）
│   └── supabase/
│       ├── client.ts               # ブラウザ用 anon クライアント（Realtime用）
│       └── server.ts               # サーバー用クライアント（anon / service_role）
├── app/
│   ├── table/[tableId]/page.tsx    # イートイン注文画面
│   ├── takeout/page.tsx            # テイクアウト注文画面
│   ├── admin/
│   │   ├── page.tsx                # 注文一覧（タブ・Realtime・通知音）
│   │   ├── orders/[orderId]/       # 注文詳細・ステータス変更
│   │   ├── takeout-schedule/       # 受取日時設定
│   │   ├── products/               # 商品管理
│   │   └── analytics/             # 売上分析
│   └── api/...                     # APIルート（上記参照）
└── components/
    ├── admin/
    │   ├── OrderCard.tsx           # 注文カード（テイクアウトはamberバナー表示）
    │   └── StatusBadge.tsx         # ステータスバッジ（tableId渡すとテイクアウト用ラベル）
    └── customer/
        ├── OrderUI.tsx             # イートイン注文UI
        ├── OrderAccessGuard.tsx    # LINE認証ガード（友だちチェックあり）
        ├── TakeoutUI.tsx           # テイクアウト注文UI
        ├── TakeoutAccessGuard.tsx  # LINE認証ガード（友だちチェックなし）
        ├── TakeoutCart.tsx         # テイクアウトカート（受取日時選択・確認チェック）
        ├── PickupDateTimePicker.tsx # 受取日時ピッカー（APIから空きスロット取得）
        ├── Cart.tsx                # イートインカート
        ├── ProductCard.tsx         # 商品カード
        ├── DrinkCard.tsx           # ドリンクカード
        └── LunchPlateSelector.tsx  # ランチプレート選択UI
```

---

## 重要な定数・ユーティリティ（types.ts）

```typescript
TAKEOUT_TABLE_ID = 'takeout'          // テイクアウトの table_id
TAKEOUT_DEFAULT_OPEN = '07:30'        // デフォルト受付開始
TAKEOUT_DEFAULT_CLOSE = '14:00'       // デフォルト受付終了
TAKEOUT_SLOT_MINUTES = 30             // スロット間隔（分）
TOPPING_NAME = 'とろろ昆布'
TOPPING_PRICE = 50
DRINK_CATEGORY = 'ドリンク'
LUNCH_PLATE_NAME = 'ランチプレート'

// 4桁注文番号（UUID → hex → mod 10000）
orderShortId(orderId: string): string

// ステータスラベル（テイクアウトは「提供済み」→「準備済み」）
getStatusLabel(status: OrderStatus, tableId?: string): string

// "YYYY-MM-DD" → "4月10日（木）"
formatScheduleDate(dateStr: string): string
```

---

## テイクアウト注文フロー

1. `/takeout` → `TakeoutAccessGuard`（LIFF初期化・ユーザーID取得）
2. `TakeoutUI`（ランチプレート除外メニュー表示）
3. `TakeoutCart`（受取日時選択 + 確認チェックボックス）
4. `POST /api/takeout/orders`（注文作成 → LINE Push通知）
5. `/takeout/complete`（完了画面）

**LINE通知メッセージ形式**:
```
■ 織はや テイクアウトご注文確認 ■

・{商品名} ×{数量}　¥{小計}
合計：¥{合計}

受取日時：{M}月{D}日 {HH:MM}

ご注文ありがとうございます✨
お気をつけてお越しください🙂‍↕️
お受け取りの際はレジにてお声がけください🌟
（注文番号: {4桁}）
ーーーーーーーーーーーーー
＼QRコード読み取りで来店スタンプGET！／
```

---

## 管理画面の操作方法

### 注文一覧（`/admin`）
- タブで「すべて / イートイン / テイクアウト」切り替え
- テイクアウトタブは受取時間の早い順に並ぶ
- 🔔ボタンで新規注文の通知音ON/OFF（最初のクリックでAudioContext起動）
- Supabase Realtime で自動更新

### 注文詳細（`/admin/orders/[orderId]`）
- ステータスボタン: 新規 → 調理中 → 準備済み（テイクアウト）/ 提供済み（イートイン）
- 「会計済みにする」ボタンで paid に更新し一覧に戻る

### 受取日時設定（`/admin/takeout-schedule`）
- 14日分を表示
- 日ごとに「受付する/しない」「開始時間」「終了時間」を設定
- 「保存」ボタンで1日分ずつ更新
- デフォルト: 07:30〜14:00、30分刻みスロット

---

## 未完了タスク・注意事項

- **RLS SQL未実行**: Supabase の alert を解消するため、以下を SQL Editor で実行が必要:
  ```sql
  -- (orders, order_items, line_users, takeout_schedule への RLS 追加)
  -- supabase/migrations/20260422_enable_rls.sql の内容を実行
  ```
  ※ `products` と `tables` は initial_schema.sql で既に RLS + SELECT ポリシー設定済み

- **管理画面に認証なし**: `/admin` 以下は現在パスワード保護なし

- **テイクアウト受取1時間前バッファ**: `GET /api/takeout/schedule` で当日スロットは `現在時刻 + 60分` 以降のみ返す

---

## マイグレーション履歴

| ファイル | 内容 |
|---|---|
| `20260331000000_initial_schema.sql` | 基本スキーマ（tables/products/orders/order_items） |
| `20240401_line_users.sql` | line_users テーブル |
| `20260407_drinks_and_timing.sql` | ドリンクtiming・lunch_plate_index・pickup_at カラム追加 |
| `20260422_enable_rls.sql` | 全テーブルRLS有効化 + anon SELECT ポリシー |
