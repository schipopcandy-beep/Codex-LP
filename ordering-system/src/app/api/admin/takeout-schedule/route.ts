import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatScheduleDate } from '@/lib/types'
import {
  addDays,
  getEffectiveDays,
  getWeeklyHours,
  todayJST,
  type WeeklyHours,
} from '@/lib/business-hours'

/** 日付ごとの設定を表示する日数（臨時休業などを先まで入れられるように） */
const ADMIN_DAYS = 45

const TIME_RE = /^\d{2}:\d{2}$/

/** 管理用: 曜日ごとの設定と、今日から ADMIN_DAYS 日分の営業設定 */
export async function GET() {
  const supabase = createServiceRoleClient()
  const today = todayJST()
  const dates = Array.from({ length: ADMIN_DAYS }, (_, i) => addDays(today, i))

  const [weekly, days] = await Promise.all([
    getWeeklyHours(supabase),
    getEffectiveDays(supabase, dates),
  ])

  return NextResponse.json({
    weekly,
    days: days.map((d) => ({ ...d, label: formatScheduleDate(d.date) })),
  })
}

/** 管理用: 1日分の個別設定（臨時休業・時間変更）を登録・更新 */
export async function POST(req: NextRequest) {
  const body: { date: string; is_open: boolean; open_time: string; close_time: string } =
    await req.json()

  const { date, is_open, open_time, close_time } = body
  if (!date) return NextResponse.json({ error: 'date は必須です' }, { status: 400 })
  if (!TIME_RE.test(open_time) || !TIME_RE.test(close_time)) {
    return NextResponse.json({ error: '時間の形式が正しくありません' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('takeout_schedule')
    .upsert(
      { date, is_open, open_time, close_time, updated_at: new Date().toISOString() },
      { onConflict: 'date' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** 管理用: 1日分の個別設定を消して、曜日の設定に戻す（?date=YYYY-MM-DD） */
export async function DELETE(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date は必須です' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('takeout_schedule').delete().eq('date', date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** 管理用: 曜日ごとの営業設定（7曜日分）をまとめて保存 */
export async function PUT(req: NextRequest) {
  const body: { weekly: WeeklyHours[] } = await req.json()
  const weekly = body.weekly ?? []

  const valid =
    weekly.length === 7 &&
    weekly.every(
      (w) =>
        Number.isInteger(w.weekday) &&
        w.weekday >= 0 &&
        w.weekday <= 6 &&
        TIME_RE.test(w.open_time) &&
        TIME_RE.test(w.close_time),
    )
  if (!valid) return NextResponse.json({ error: '曜日の設定が正しくありません' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('business_hours_weekly').upsert(
    weekly.map((w) => ({
      weekday: w.weekday,
      is_open: w.is_open,
      open_time: w.open_time,
      close_time: w.close_time,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'weekday' },
  )

  if (error) {
    return NextResponse.json(
      { error: `${error.message}（営業日の表が未作成の場合は、案内したSQLを実行してください）` },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
