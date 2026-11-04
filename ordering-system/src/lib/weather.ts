import type { SupabaseClient } from '@supabase/supabase-js'

const SENDAI_LAT = 38.2682
const SENDAI_LON = 140.8694

/**
 * 仙台の今の天気を、今日（日本時間）の天気として weather_log に記録する
 * 毎日11時の定時処理（/api/cron/morning）で呼ぶ。同じ日にもう一度呼ぶと上書きする。
 * OPENWEATHERMAP_API_KEY がなければ何もしない
 */
export async function recordTodayWeather(supabase: SupabaseClient): Promise<void> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY

  const jstOffset = 9 * 60 * 60 * 1000
  const nowJst = new Date(Date.now() + jstOffset)
  const todayJst = nowJst.toISOString().slice(0, 10)

  if (apiKey) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${SENDAI_LAT}&lon=${SENDAI_LON}&appid=${apiKey}&units=metric&lang=ja`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (res.ok) {
        const w = await res.json()
        await supabase.from('weather_log').upsert(
          {
            date: todayJst,
            fetched_at: new Date().toISOString(),
            temp_max: w.main?.temp_max ?? null,
            temp_min: w.main?.temp_min ?? null,
            temp_avg: w.main?.temp ?? null,
            weather_main: w.weather?.[0]?.main ?? null,
            weather_desc: w.weather?.[0]?.description ?? null,
            precipitation: w.rain?.['1h'] ?? w.rain?.['3h'] ?? 0,
            icon: w.weather?.[0]?.icon ?? null,
          },
          { onConflict: 'date' },
        )
      }
    } catch (err) {
      console.error('Weather fetch error:', err)
    }
  }
}
