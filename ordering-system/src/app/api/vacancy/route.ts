import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/** 店内席の table_id 一覧（テイクアウトを除く） */
const SEAT_IDS = [
  'table-1', 'table-2', 'table-3', 'table-4',
  'counter-1', 'counter-2', 'counter-3', 'counter-4',
]

export async function GET() {
  const supabase = createServiceRoleClient()

  // 未会計（paid 以外）の伝票から table_id を取得
  const { data, error } = await supabase
    .from('orders')
    .select('table_id')
    .neq('status', 'paid')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 注文が入っている店内席（重複排除）
  const occupiedSeats = new Set(
    (data ?? [])
      .map((o) => o.table_id)
      .filter((id) => SEAT_IDS.includes(id)),
  )

  const total = SEAT_IDS.length
  const occupied = occupiedSeats.size
  const vacant = total - occupied

  return NextResponse.json(
    { total, occupied, vacant },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
