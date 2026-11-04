import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, todayJST } from '@/lib/business-hours'
import { pushLineMessages } from '@/lib/line-message'
import { TAKEOUT_TABLE_ID } from '@/lib/types'

/**
 * 来店後のLINEメッセージ（管理画面の「LINEメッセージ」で設定し、毎日11時の定時処理で送る）
 *
 * - 来店 = LINEから注文して会計済みになった注文（テイクアウトは受け取り日、それ以外は注文した日）
 * - お客様ごとの「最後の来店日」から days_after 日後に、1回だけ送る（同じ来店日の分は二度送らない）
 * - 定時処理が止まった日があっても送り漏れないよう、CATCH_UP_DAYS 日前の予定分までさかのぼる
 * - 送るようにした日（enabled_from）より後に送る予定の分から送る（GASからの切り替えで二重に送らないため）
 */

export interface MessageRule {
  key: string
  name: string
  enabled: boolean
  days_after: number
  text: string
  image_url: string | null
  preview_url: string | null
  enabled_from: string | null
  sort_order: number
  updated_at: string
}

/** 何日前の送る予定分までさかのぼるか */
const CATCH_UP_DAYS = 2
/** 1回の定時処理で、1つのメッセージを送る最大人数（設定の間違いで大量に送らないため） */
const MAX_PER_RUN = 300

export interface RuleResult {
  key: string
  name: string
  /** 送る相手（送り済みを除く） */
  targets: number
  sent: number
  failed: number
  /** MAX_PER_RUN を超えたため、送らずに残した人数 */
  skipped: number
}

/** 日本時間の日付（YYYY-MM-DD） */
const jstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

/** LINE IDごとの最後の来店日（since 以降の来店だけを見る） */
async function lastVisits(supabase: SupabaseClient, since: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const sinceUtc = new Date(`${since}T00:00:00+09:00`).toISOString()
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('orders')
      .select('line_user_id, table_id, created_at, pickup_at')
      .eq('status', 'paid')
      .not('line_user_id', 'is', null)
      .or(`created_at.gte.${sinceUtc},pickup_at.gte.${since}`)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { line_user_id: string; table_id: string; created_at: string; pickup_at: string | null }[]
    for (const o of rows) {
      const visit = o.table_id === TAKEOUT_TABLE_ID && o.pickup_at ? o.pickup_at.slice(0, 10) : jstDate(o.created_at)
      const prev = result.get(o.line_user_id)
      if (!prev || visit > prev) result.set(o.line_user_id, visit)
    }
    if (rows.length < pageSize) break
  }
  return result
}

/** そのメッセージを today に送る相手（最後の来店日つき）。送り済みは除いていない */
function dueTargets(rule: MessageRule, visits: Map<string, string>, today: string) {
  const earliest = addDays(today, -CATCH_UP_DAYS)
  const targets: { userId: string; visitDate: string }[] = []
  for (const [userId, visitDate] of visits) {
    const due = addDays(visitDate, rule.days_after)
    if (due > today || due < earliest) continue
    if (rule.enabled_from && due <= rule.enabled_from) continue
    targets.push({ userId, visitDate })
  }
  return targets
}

/** 送り済み（送れた）の組み合わせ "LINE ID__来店日" */
async function sentKeys(supabase: SupabaseClient, ruleKey: string, userIds: string[]): Promise<Set<string>> {
  const keys = new Set<string>()
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await supabase
      .from('line_message_logs')
      .select('line_user_id, visit_date')
      .eq('rule_key', ruleKey)
      .eq('ok', true)
      .in('line_user_id', userIds.slice(i, i + 200))
    for (const row of (data ?? []) as { line_user_id: string; visit_date: string }[]) {
      keys.add(`${row.line_user_id}__${row.visit_date}`)
    }
  }
  return keys
}

/** LINEで送る吹き出し（文章、画像があれば画像も） */
export function buildMessages(rule: Pick<MessageRule, 'text' | 'image_url' | 'preview_url'>): unknown[] {
  const messages: unknown[] = [{ type: 'text', text: rule.text }]
  if (rule.image_url) {
    messages.push({ type: 'image', originalContentUrl: rule.image_url, previewImageUrl: rule.preview_url || rule.image_url })
  }
  return messages
}

export async function getRules(supabase: SupabaseClient): Promise<MessageRule[]> {
  const { data, error } = await supabase.from('line_message_rules').select('*').order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as MessageRule[]
}

/**
 * 来店後のメッセージを送る（dryRun なら送らずに人数だけ数える）
 * today を明日にして dryRun すると、明日送る予定の人数の目安になる
 */
export async function sendVisitMessages(
  supabase: SupabaseClient,
  { today = todayJST(), dryRun = false }: { today?: string; dryRun?: boolean } = {},
): Promise<RuleResult[]> {
  const rules = (await getRules(supabase)).filter((r) => r.enabled)
  if (rules.length === 0) return []

  const maxDays = Math.max(...rules.map((r) => r.days_after))
  const visits = await lastVisits(supabase, addDays(today, -(maxDays + CATCH_UP_DAYS)))

  const results: RuleResult[] = []
  for (const rule of rules) {
    const due = dueTargets(rule, visits, today)
    const done = await sentKeys(supabase, rule.key, due.map((t) => t.userId))
    const targets = due.filter((t) => !done.has(`${t.userId}__${t.visitDate}`))
    const result: RuleResult = { key: rule.key, name: rule.name, targets: targets.length, sent: 0, failed: 0, skipped: 0 }

    if (!dryRun) {
      const messages = buildMessages(rule)
      for (const [i, t] of targets.entries()) {
        if (i >= MAX_PER_RUN) {
          result.skipped++
          continue
        }
        const ok = await pushLineMessages(t.userId, messages)
        if (ok) result.sent++
        else result.failed++
        await supabase
          .from('line_message_logs')
          .upsert(
            { rule_key: rule.key, line_user_id: t.userId, visit_date: t.visitDate, ok, sent_at: new Date().toISOString() },
            { onConflict: 'rule_key,line_user_id,visit_date' },
          )
      }
    }
    results.push(result)
  }
  return results
}
