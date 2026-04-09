import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  TAKEOUT_DEFAULT_OPEN,
  TAKEOUT_DEFAULT_CLOSE,
  generatePickupSlots,
  formatScheduleDate,
  type AvailableDay,
  type TakeoutSchedule,
} from '@/lib/types'

/** JST の今日の日付を YYYY-MM-DD で返す */
function todayJST(): string {
  const now = new Date()
  // JST = UTC+9
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

/** JST の現在時刻を HH:MM で返す */
function currentTimeJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const h = jst.getUTCHours()
  const m = jst.getUTCMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** YYYY-MM-DD の翌日を返す */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-')
}

/** HH:MM を分に変換 */
function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export async function GET() {
  const supabase = createServiceRoleClient()
  const today = todayJST()
  const nowTime = currentTimeJST()

  // 今日〜7日後の日付リスト
  const dates = Array.from({ length: 8 }, (_, i) => addDays(today, i))

  // DBから該当日付の設定を取得
  const { data: rows } = await supabase
    .from('takeout_schedule')
    .select('*')
    .in('date', dates)

  const scheduleMap = new Map<string, TakeoutSchedule>(
    (rows ?? []).map((r) => [r.date, r]),
  )

  const available: AvailableDay[] = []

  for (const date of dates) {
    const sched = scheduleMap.get(date)
    const isOpen = sched ? sched.is_open : true
    if (!isOpen) continue

    const openTime = sched?.open_time ?? TAKEOUT_DEFAULT_OPEN
    const closeTime = sched?.close_time ?? TAKEOUT_DEFAULT_CLOSE

    let slots = generatePickupSlots(openTime, closeTime)

    // 今日の場合: 現在時刻 + 60分 以降のスロットのみ
    if (date === today) {
      const minSlotMin = toMin(nowTime) + 60
      slots = slots.filter((s) => toMin(s) >= minSlotMin)
    }

    if (slots.length === 0) continue

    available.push({ date, label: formatScheduleDate(date), slots })
  }

  return NextResponse.json(available)
}
