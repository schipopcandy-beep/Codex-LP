-- =============================================================
-- LINE タグシステム
-- line_tags  : タグマスタ（定義）
-- line_user_tags : ユーザー-タグ 多対多紐付け
--
-- タグ命名規則: snake_case、接頭辞でカテゴリ分類
--   status_*  : ユーザーステータス（新規/アクティブ/休眠）
--   visit_*   : 来店回数
--   type_*    : 利用タイプ（イートイン/テイクアウト）
--   source_*  : 流入元（QR/SNS）
-- =============================================================

-- 1. タグマスタ
CREATE TABLE IF NOT EXISTS line_tags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ユーザー-タグ紐付け（多対多）
CREATE TABLE IF NOT EXISTS line_user_tags (
  user_id     TEXT        NOT NULL REFERENCES line_users (user_id) ON DELETE CASCADE,
  tag_id      UUID        NOT NULL REFERENCES line_tags (id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_line_user_tags_user_id ON line_user_tags (user_id);
CREATE INDEX IF NOT EXISTS idx_line_user_tags_tag_id  ON line_user_tags (tag_id);

-- RLS（service_role のみ操作可）
ALTER TABLE line_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_user_tags ENABLE ROW LEVEL SECURITY;

-- 3. タグマスタ初期データ（12タグ）
-- ===========================================================
--  接頭辞    | タグ名                | 意味
-- -----------|-----------------------|------------------------
--  status_   | status_new            | 友だち追加直後・未注文
--            | status_active         | 直近来店あり（アクティブ）
--            | status_dormant_30d    | 30日以上来店なし
--            | status_dormant_60d    | 60日以上来店なし
--  visit_    | visit_1               | 注文1回完了
--            | visit_2               | 注文2回完了
--            | visit_3plus           | 注文3回以上
--  type_     | type_eatin            | イートイン利用
--            | type_takeout          | テイクアウト利用
--  source_   | source_qr_table       | テーブルQRから流入
--            | source_qr_takeout     | テイクアウトQRから流入
--            | source_instagram      | Instagramから流入
-- ===========================================================
INSERT INTO line_tags (name, description) VALUES
  ('status_new',         '友だち追加直後・未注文ユーザー'),
  ('status_active',      '直近30日以内に注文あり（アクティブ）'),
  ('status_dormant_30d', '30日以上注文なし（休眠予備軍）'),
  ('status_dormant_60d', '60日以上注文なし（休眠）'),
  ('visit_1',            '注文1回完了'),
  ('visit_2',            '注文2回完了'),
  ('visit_3plus',        '注文3回以上'),
  ('type_eatin',         'イートイン利用あり'),
  ('type_takeout',       'テイクアウト利用あり'),
  ('source_qr_table',    'テーブル設置QRコードから友だち追加'),
  ('source_qr_takeout',  'テイクアウト用QRコードから友だち追加'),
  ('source_instagram',   'Instagramプロフィールから友だち追加')
ON CONFLICT (name) DO NOTHING;
