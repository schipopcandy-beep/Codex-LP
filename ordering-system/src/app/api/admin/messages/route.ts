import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { addDays, todayJST } from '@/lib/business-hours'
import { getMessageQuota } from '@/lib/line-message'
import { getRules, sendVisitMessages } from '@/lib/visit-messages'

/**
 * 管理用: 来店後のLINEメッセージの設定と、送った数・送る予定の数・今月の送信数
 */
export async function GET() {
  const supabase = createServiceRoleClient()
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [rules, quota, upcoming, logsRes] = await Promise.all([
      getRules(supabase),
      getMessageQuota(),
      // 明日の11時に送る予定の人数（目安。今日このあと来店した人は変わる）
      sendVisitMessages(supabase, { today: addDays(todayJST(), 1), dryRun: true }),
      supabase.from('line_message_logs').select('rule_key, ok').gte('sent_at', since),
    ])
    const logs = (logsRes.data ?? []) as { rule_key: string; ok: boolean }[]
    return NextResponse.json({
      rules: rules.map((r) => ({
        ...r,
        upcoming: upcoming.find((u) => u.key === r.key)?.targets ?? null,
        sent30: logs.filter((l) => l.rule_key === r.key && l.ok).length,
        failed30: logs.filter((l) => l.rule_key === r.key && !l.ok).length,
      })),
      quota,
    })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json(
      { error: message.includes('line_message') ? 'LINEメッセージの表がまだありません。案内したSQLを実行してください' : message },
      { status: 500 },
    )
  }
}

/**
 * 管理用: メッセージを追加する（最初は送らない状態）
 * body: { name? }
 */
export async function POST(req: NextRequest) {
  const body: { name?: string } = await req.json().catch(() => ({}))
  const name = (body.name ?? '').trim().slice(0, 40) || '新しいメッセージ'
  const supabase = createServiceRoleClient()
  const { data: last } = await supabase
    .from('line_message_rules')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await supabase
    .from('line_message_rules')
    .insert({
      key: `m${Date.now().toString(36)}`,
      name,
      enabled: false,
      days_after: 14,
      text: 'ここにメッセージを入れてください',
      sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
