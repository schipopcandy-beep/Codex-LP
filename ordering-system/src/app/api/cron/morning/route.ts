import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isCronRequest } from '@/lib/admin-auth'
import { recordTodayWeather } from '@/lib/weather'
import { sendVisitMessages } from '@/lib/visit-messages'

/**
 * 毎日11時（日本時間）の定時処理
 * - 今日の天気を記録する（分析用）
 * - 来店後のLINEメッセージを送る（管理画面の「LINEメッセージ」で設定したもの）
 * 定時処理の数を増やさないよう、11時にやることはここにまとめる
 * Authorization: Bearer <CRON_SECRET> のときだけ動く
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  await recordTodayWeather(supabase)
  // 表がまだない（SQL未実行）など、メッセージが送れなくても天気の記録は済ませる
  const messages = await sendVisitMessages(supabase).catch((err) => {
    console.error('来店後メッセージの送信に失敗:', err)
    return { error: (err as Error).message }
  })
  console.log('[cron] morning:', JSON.stringify(messages))
  return NextResponse.json({ ok: true, messages })
}
