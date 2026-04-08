import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  TAKEOUT_DEFAULT_OPEN,
  TAKEOUT_DEFAULT_CLOSE,
  formatScheduleDate,
  type TakeoutSchedule,
} from '@/lib/types'

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-')
}

function todayJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

/** 管理用: 今日〜14日分のスケジュール一覧を返す */
export async function GET() {
  const supabase = createServiceRoleClient()
  const today = todayJST()
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  const { data: rows, error } = await supabase
    .from('takeout_schedule')
    .select('*')
    .in('date', dates)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const scheduleMap = new Map<string, TakeoutSchedule>(
    (rows ?? []).map((r) => [r.date, r]),
  )

  const result = dates.map((date) => {
    const sched = scheduleMap.get(date)
    return {
      date,
      label: formatScheduleDate(date),
      is_open: sched ? sched.is_open : true,
      open_time: sched?.open_time ?? TAKEOUT_DEFAULT_OPEN,
      close_time: sched?.close_time ?? TAKEOUT_DEFAULT_CLOSE,
      is_custom: !!sched,
    }
  })

  return NextResponse.json(result)
}

/** 管理用: 1日分のスケジュールを登録・更新 */
export async function POST(req: NextRequest) {
  const body: { date: string; is_open: boolean; open_time: string; close_time: string } =
    await req.json()

  const { date, is_open, open_time, close_time } = body
  if (!date) return NextResponse.json({ error: 'date は必須です' }, { status: 400 })

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
