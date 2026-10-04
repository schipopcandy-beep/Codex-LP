import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generatePickupSlots, formatScheduleDate, type AvailableDay } from '@/lib/types'
import { addDays, getEffectiveDays, todayJST } from '@/lib/business-hours'

/** JST の現在時刻を HH:MM で返す */
function currentTimeJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}

/** HH:MM を分に変換 */
function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** お客様向け: 受け取りを選べる日（今日〜7日後）と時間帯。休業日は含めない */
export async function GET() {
  const supabase = createServiceRoleClient()
  const today = todayJST()
  const nowTime = currentTimeJST()

  const dates = Array.from({ length: 8 }, (_, i) => addDays(today, i))
  const days = await getEffectiveDays(supabase, dates)

  const available: AvailableDay[] = []
  for (const day of days) {
    if (!day.is_open) continue

    let slots = generatePickupSlots(day.open_time, day.close_time)

    // 今日の場合: 現在時刻 + 60分 以降のスロットのみ
    if (day.date === today) {
      const minSlotMin = toMin(nowTime) + 60
      slots = slots.filter((s) => toMin(s) >= minSlotMin)
    }

    if (slots.length === 0) continue
    available.push({ date: day.date, label: formatScheduleDate(day.date), slots })
  }

  return NextResponse.json(available)
}
