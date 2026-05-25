import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

const SENDAI_LAT = 38.2682
const SENDAI_LON = 140.8694

export async function GET() {
  const supabase = createServiceRoleClient()
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

  const { data, error } = await supabase
    .from('weather_log')
    .select('date, temp_max, temp_min, temp_avg, weather_main, weather_desc, icon, precipitation')
    .order('date', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
