-- =============================================================
-- Phase 3: 競合店・イベント管理
-- =============================================================

-- 競合店マスタ
CREATE TABLE IF NOT EXISTS competitor_shops (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  open_weekdays INTEGER[]   NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=日 1=月 ... 6=土
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE competitor_shops ENABLE ROW LEVEL SECURITY;

-- 競合店 日次ステータス上書き（手動変更）
CREATE TABLE IF NOT EXISTS competitor_status_log (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id   UUID        NOT NULL REFERENCES competitor_shops(id) ON DELETE CASCADE,
  date      DATE        NOT NULL,
  is_open   BOOLEAN     NOT NULL,
  note      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, date)
);

ALTER TABLE competitor_status_log ENABLE ROW LEVEL SECURITY;

-- 仙台エリアイベント
CREATE TABLE IF NOT EXISTS sendai_events (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT        NOT NULL,
  date      DATE        NOT NULL,
  end_date  DATE,
  location  TEXT,
  scale     INTEGER     NOT NULL DEFAULT 3 CHECK (scale BETWEEN 1 AND 5),
  note      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sendai_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_competitor_status_shop_date ON competitor_status_log(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_sendai_events_date ON sendai_events(date);

-- =============================================================
-- シードデータ（3店舗）
-- 0=日 1=月 2=火 3=水 4=木 5=金 6=土
-- そら:  土日月休み → 火〜金 [2,3,4,5]
-- あみ:  日曜休み   → 月〜土 [1,2,3,4,5,6]
-- LAPIS: 月曜休み   → 日・火〜土 [0,2,3,4,5,6]
-- =============================================================
INSERT INTO competitor_shops (name, open_weekdays) VALUES
  ('町のおにぎり屋そら', ARRAY[2,3,4,5]::integer[]),
  ('おにぎり屋あみ',     ARRAY[1,2,3,4,5,6]::integer[]),
  ('LAPIS＆DELICA',     ARRAY[0,2,3,4,5,6]::integer[])
ON CONFLICT DO NOTHING;
