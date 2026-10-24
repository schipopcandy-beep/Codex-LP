import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ACTIVE_STATUSES, getTodayEntries, notifyApproaching } from '@/lib/waitlist'

/**
 * お客様向け: 自分の順番待ちを取り消す
 * body: { token, line_user_id? }
 */
export async function POST(req: NextRequest) {
  const body: { token?: string; line_user_id?: string } = await req.json()
  if (!body.token && !body.line_user_id) return NextResponse.json({ error: '受付が見つかりません' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const entries = await getTodayEntries(supabase)
  const mine = entries.find(
    (e) =>
      (ACTIVE_STATUSES as readonly string[]).includes(e.status) &&
      ((body.token && e.token === body.token) || (body.line_user_id && e.line_user_id === body.line_user_id)),
  )
  if (!mine) return NextResponse.json({ error: '受付が見つかりません' }, { status: 404 })

  const { error } = await supabase
    .from('waitlist_entries')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', mine.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 順番が繰り上がるので、近づいた人にお知らせする
  await notifyApproaching(supabase, await getTodayEntries(supabase)).catch(() => {})
  return NextResponse.json({ ok: true })
}
