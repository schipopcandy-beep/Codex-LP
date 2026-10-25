import type { SupabaseClient } from '@supabase/supabase-js'
import { getEffectiveDays, todayJST } from '@/lib/business-hours'
import { sendLineMessage } from '@/lib/line-message'
import { WAIT_MINUTES_PER_GROUP, type WaitlistEntry } from '@/lib/types'

/** 待ち・呼び出し中・不在（まだ案内していない受付） */
export const ACTIVE_STATUSES = ['waiting', 'called', 'absent'] as const

/** 日本時間の今の時刻（HH:MM） */
function nowTimeJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(11, 16)
}

/** 今日の受付をすべて読む（受付番号順） */
export async function getTodayEntries(supabase: SupabaseClient): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase
    .from('waitlist_entries')
    .select('*')
    .eq('date', todayJST())
    .order('number', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as WaitlistEntry[]
}

/**
 * 案内する順番に並べた「待ち」の受付
 * 呼び出しのとき不在で、あとから戻ってきたお客様は、次に空いた席へ優先して案内する（戻った順）
 */
export function queueOf(entries: WaitlistEntry[]): WaitlistEntry[] {
  const waiting = entries.filter((e) => e.status === 'waiting')
  const returned = waiting
    .filter((e) => e.returned_at)
    .sort((a, b) => (a.returned_at ?? '').localeCompare(b.returned_at ?? ''))
  const normal = waiting.filter((e) => !e.returned_at).sort((a, b) => a.number - b.number)
  return [...returned, ...normal]
}

/**
 * おおよその待ち時間（分）。5分単位に切り上げる
 * 前に ahead 組いるとき。空席があって前に誰もいなければ 0（すぐご案内）
 */
export function estimateMinutes(ahead: number, hasVacancy: boolean): number {
  if (ahead === 0 && hasVacancy) return 0
  return Math.ceil(((ahead + 1) * WAIT_MINUTES_PER_GROUP) / 5) * 5
}

/** 今、順番待ちを受け付けられるか（今日が営業日で、営業時間内） */
export async function getAcceptance(
  supabase: SupabaseClient,
): Promise<{ accepting: boolean; open_time: string | null; close_time: string | null }> {
  const [day] = await getEffectiveDays(supabase, [todayJST()])
  if (!day || !day.is_open) return { accepting: false, open_time: null, close_time: null }
  const open = day.open_time.slice(0, 5)
  const close = day.close_time.slice(0, 5)
  const now = nowTimeJST()
  return { accepting: open <= now && now < close, open_time: open, close_time: close }
}

/**
 * 順番が近づいたお客様（前にあと1組）に、LINEで1回だけお知らせする
 * 受付・呼び出し・案内・取り消しなど、順番が動くたびに呼ぶ
 */
export async function notifyApproaching(supabase: SupabaseClient, entries: WaitlistEntry[]): Promise<void> {
  const queue = queueOf(entries)
  const target = queue[1]
  if (!target || target.notified_soon) return

  // 先に印を付けて、同時に呼ばれても2回送らないようにする
  const { data } = await supabase
    .from('waitlist_entries')
    .update({ notified_soon: true, updated_at: new Date().toISOString() })
    .eq('id', target.id)
    .eq('notified_soon', false)
    .select('id')
  if (!data || data.length === 0 || !target.line_user_id) return

  await sendLineMessage(
    target.line_user_id,
    `【織はや】受付番号 ${target.number}番のお客様\nまもなく順番です（あと1組）。\nお店の近くでお待ちください🍙`,
  ).catch((err) => console.error('順番待ちのお知らせに失敗:', err))
}

/** 呼び出しのLINEを送る */
export async function notifyCalled(entry: WaitlistEntry): Promise<void> {
  if (!entry.line_user_id) return
  await sendLineMessage(
    entry.line_user_id,
    `【織はや】受付番号 ${entry.number}番のお客様\nお待たせいたしました！順番になりました。\nお店にお越しください🍙`,
  ).catch((err) => console.error('順番待ちの呼び出しに失敗:', err))
}
