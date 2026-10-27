import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { addDays, todayJST } from '@/lib/business-hours'

/**
 * 何日前までの未会計の伝票を出すか
 * 会計し忘れた古い伝票まで毎回読むとデータベースの負荷が増えるため、
 * 直近の伝票（注文日か受取日がこの日数以内）だけにする。先の日付のテイクアウト予約は出る
 */
const RECENT_DAYS = 3

export async function GET() {
  const supabase = createServiceRoleClient()

  // 未会計（paid 以外）の伝票を取得
  const since = addDays(todayJST(), -RECENT_DAYS)
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      table:tables(*),
      order_items(
        *,
        product:products(*)
      )
    `)
    .neq('status', 'paid')
    .or(`created_at.gte.${since}T00:00:00+09:00,pickup_at.gte.${since}`)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
