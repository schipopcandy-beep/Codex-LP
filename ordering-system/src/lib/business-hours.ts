import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TAKEOUT_DEFAULT_OPEN,
  TAKEOUT_DEFAULT_CLOSE,
  type TakeoutSchedule,
} from '@/lib/types'

/** 曜日ごとの営業設定（0 = 日曜 … 6 = 土曜） */
export interface WeeklyHours {
  weekday: number
  is_open: boolean
  open_time: string
  close_time: string
}

/** ある日の営業設定（日付ごとの設定があればそれ、なければ曜日の設定） */
export interface EffectiveDay {
  date: string
  is_open: boolean
  open_time: string
  close_time: string
  /** 日付ごとの個別設定（臨時休業・時間変更）があるか */
  is_custom: boolean
}

export const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

/** 曜日の設定が未登録のときの既定値（これまでの「毎日 7:30〜14:00 営業」） */
export function defaultWeeklyHours(): WeeklyHours[] {
  return WEEKDAY_NAMES.map((_, weekday) => ({
    weekday,
    is_open: true,
    open_time: TAKEOUT_DEFAULT_OPEN,
    close_time: TAKEOUT_DEFAULT_CLOSE,
  }))
}

/** YYYY-MM-DD の曜日（0 = 日曜） */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** 日本時間の今日（YYYY-MM-DD） */
export function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** YYYY-MM-DD の n 日後 */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * 曜日ごとの営業設定を読む
 * 表がまだない（SQL未実行）・行が欠けている場合は既定値で補う
 */
export async function getWeeklyHours(supabase: SupabaseClient): Promise<WeeklyHours[]> {
  const weekly = defaultWeeklyHours()
  const { data, error } = await supabase.from('business_hours_weekly').select('*')
  if (error || !data) return weekly
  for (const row of data as WeeklyHours[]) {
    if (row.weekday >= 0 && row.weekday <= 6) {
      weekly[row.weekday] = {
        weekday: row.weekday,
        is_open: row.is_open,
        open_time: row.open_time,
        close_time: row.close_time,
      }
    }
  }
  return weekly
}

/** 指定した日付それぞれの営業設定を求める */
export async function getEffectiveDays(
  supabase: SupabaseClient,
  dates: string[],
): Promise<EffectiveDay[]> {
  const [weekly, overrides] = await Promise.all([
    getWeeklyHours(supabase),
    supabase.from('takeout_schedule').select('*').in('date', dates),
  ])
  const overrideMap = new Map<string, TakeoutSchedule>(
    ((overrides.data ?? []) as TakeoutSchedule[]).map((r) => [r.date, r]),
  )

  return dates.map((date) => {
    const custom = overrideMap.get(date)
    if (custom) {
      return {
        date,
        is_open: custom.is_open,
        open_time: custom.open_time,
        close_time: custom.close_time,
        is_custom: true,
      }
    }
    const base = weekly[weekdayOf(date)]
    return {
      date,
      is_open: base.is_open,
      open_time: base.open_time,
      close_time: base.close_time,
      is_custom: false,
    }
  })
}
