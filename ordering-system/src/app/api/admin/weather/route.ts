import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { recordTodayWeather } from '@/lib/weather'

/** 管理用: 今の天気を記録して、直近30日の天気を返す */
export async function GET() {
  const supabase = createServiceRoleClient()
  await recordTodayWeather(supabase)

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
