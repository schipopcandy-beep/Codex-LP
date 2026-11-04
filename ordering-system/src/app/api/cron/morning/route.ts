import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isCronRequest } from '@/lib/admin-auth'
import { recordTodayWeather } from '@/lib/weather'

/**
 * 毎日11時（日本時間）の定時処理
 * - 今日の天気を記録する（分析用）
 * 定時処理の数を増やさないよう、11時にやることはここにまとめる（来店後のメッセージ送信もここに入れる予定）
 * Authorization: Bearer <CRON_SECRET> のときだけ動く
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await recordTodayWeather(createServiceRoleClient())
  return NextResponse.json({ ok: true })
}
