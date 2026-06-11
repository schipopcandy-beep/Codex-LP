-- 売り切れ時刻フィールドを products に追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_out_at TIMESTAMPTZ;

-- 売り切れ履歴ログ（日次集計・売上予測の基礎データ）
CREATE TABLE IF NOT EXISTS product_soldout_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sold_out_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  date         TEXT NOT NULL,  -- YYYY-MM-DD (JST)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soldout_log_product_id ON product_soldout_log(product_id);
CREATE INDEX IF NOT EXISTS idx_soldout_log_date       ON product_soldout_log(date);

-- 天気ログ（仙台市の日次記録・売上予測の説明変数）
CREATE TABLE IF NOT EXISTS weather_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD (JST)
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  temp_max      NUMERIC,
  temp_min      NUMERIC,
  temp_avg      NUMERIC,
  weather_main  TEXT,          -- Clear / Clouds / Rain / Snow など
  weather_desc  TEXT,          -- 詳細説明（日本語）
  precipitation NUMERIC DEFAULT 0,  -- 降水量 mm
  icon          TEXT,          -- OpenWeatherMap icon code
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weather_log_date ON weather_log(date);
