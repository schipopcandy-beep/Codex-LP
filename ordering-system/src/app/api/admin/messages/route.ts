import { NextResponse } from 'next/server'
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
