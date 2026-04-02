# 🍙 おにぎり席注文システム

おにぎり屋の店内注文システムです。各席のQRコードをスマホで読み取って注文でき、店舗側はiPadで管理します。

## 機能概要

| 機能 | 説明 |
|---|---|
| QRコード注文 | 席ごとのURLでメニューを表示 |
| 同一伝票追加 | 同じ席の複数人の注文を1つの伝票にまとめる |
| 追加注文 | 注文後も同じ伝票に追加できる |
| 売り切れ管理 | 管理画面からリアルタイムに切り替え |
| 会計処理 | 席単位でステータス管理 |
| リアルタイム更新 | 管理画面は注文が来たら自動更新 |

---

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) / TypeScript / Tailwind CSS
- **バックエンド**: Next.js API Routes
- **DB**: Supabase (PostgreSQL + Realtime)
- **デプロイ**: Vercel

---

## ローカルセットアップ

### 1. リポジトリのクローン

```bash
git clone <repo-url>
cd ordering-system
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. Supabase プロジェクト作成

1. [Supabase](https://supabase.com) にサインアップしてプロジェクトを作成
2. **Settings > API** から以下を取得：
   - `URL`
   - `anon key`
   - `service_role key`（秘密にすること）

### 4. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集して取得したキーを設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 5. DBのセットアップ

**Supabase ダッシュボード > SQL Editor** を開いて順番に実行：

```sql
-- ① スキーマ作成
-- supabase/schema.sql の内容をコピーして実行

-- ② 初期データ投入
-- supabase/seed.sql の内容をコピーして実行
```

### 6. Realtimeの有効化

**Supabase ダッシュボード > Database > Replication** で以下のテーブルを有効化：
- `orders`
- `order_items`

### 7. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 にアクセス（`/admin` にリダイレクトされます）

---

## 画面一覧

| URL | 説明 | デバイス |
|---|---|---|
| `/table/[tableId]` | メニュー・カート・注文 | スマホ |
| `/table/[tableId]/complete` | 注文完了・追加注文 | スマホ |
| `/admin` | 未会計注文一覧 | iPad |
| `/admin/orders/[orderId]` | 注文詳細・ステータス変更・会計 | iPad |
| `/admin/products` | 商品管理（売り切れ切り替え） | iPad |

### 席ID一覧

| 席ID | 席名 |
|---|---|
| `table-1` | テーブル席 1 |
| `table-2` | テーブル席 2 |
| `table-3` | テーブル席 3 |
| `table-4` | テーブル席 4 |
| `counter-1` | カウンター 1 |
| `counter-2` | カウンター 2 |
| `counter-3` | カウンター 3 |
| `counter-4` | カウンター 4 |

### QRコード用URL（例）

```
https://your-domain.vercel.app/table/table-1
https://your-domain.vercel.app/table/counter-1
```

---

## 注文フロー

```
お客さま                         店舗
   │                              │
   │  QRスキャン                  │
   │ ─── /table/[tableId] ────>  │
   │                              │
   │  商品選択・カート追加         │
   │  (トッピング選択可)           │
   │                              │
   │  注文確定                    │
   │ ─── POST /api/orders ─────> DB
   │                              │  ← Realtime で自動更新
   │  /complete 表示              │ /admin に通知
   │                              │
   │  (追加注文可能)               │  ステータス変更
   │                              │  new → preparing → served
   │                              │
   │  レジで会計                   │
   │ <─────────────────────────── │  → paid
```

---

## DB スキーマ

```
tables
├── id (PK, text)    ← 'table-1', 'counter-1' など
├── name (text)
└── is_active (bool)

products
├── id (UUID, PK)
├── name, price, description
├── image_url, category
├── sort_order
├── is_sold_out
└── topping_available    ← とろろ昆布 (+¥50) の選択可否

orders  ← 席ごとの「伝票」
├── id (UUID, PK)
├── table_id (FK → tables)
├── status: new | preparing | served | paid
└── created_at, updated_at

order_items  ← 明細
├── id (UUID, PK)
├── order_id (FK → orders, CASCADE)
├── product_id (FK → products)
├── quantity
├── unit_price    ← 注文時点の価格を保存
├── with_topping
└── created_at
```

---

## Vercel デプロイ

1. GitHub に push
2. [Vercel](https://vercel.com) でリポジトリを import
3. **Environment Variables** に `.env.local` と同じ値を設定
4. Deploy

---

## 商品画像の追加

1. **Supabase > Storage** で `product-images` バケットを作成（公開バケット）
2. 画像ファイルをアップロード
3. 各商品の `image_url` を更新：

```sql
UPDATE products
  SET image_url = 'https://<project>.supabase.co/storage/v1/object/public/product-images/yaki-sake.jpg'
WHERE name = '焼しゃけ';
```

---

## 注文ステータス

| ステータス | 意味 |
|---|---|
| `new` | 新規注文（まだ調理に入っていない） |
| `preparing` | 調理中 |
| `served` | 提供済み |
| `paid` | 会計済み |
