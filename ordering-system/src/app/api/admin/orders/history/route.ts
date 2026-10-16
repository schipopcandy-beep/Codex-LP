import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * 管理用: 指定した日（日本時間）の注文をすべて取得する（会計済みも含む）
 * GET ?date=YYYY-MM-DD（省略時は今日）
 * - 店内注文: その日に注文されたもの
 * - テイクアウト: その日に注文された、またはその日に受け取るもの
 */
export async function GET(req: NextRequest) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())
  const date = req.nextUrl.searchParams.get('date') ?? today
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '日付の形式が正しくありません' }, { status: 400 })
  }

  // 日本時間のその日の 0:00〜翌日 0:00（UTCで指定する）
  const start = new Date(`${date}T00:00:00+09:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  const supabase = createServiceRoleClient()
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
    .or(
      `and(created_at.gte.${start.toISOString()},created_at.lt.${end.toISOString()}),pickup_at.like.${date}*`,
    )
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
