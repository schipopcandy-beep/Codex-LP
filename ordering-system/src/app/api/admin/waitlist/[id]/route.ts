import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getTodayEntries, notifyApproaching, notifyCalled } from '@/lib/waitlist'
import type { WaitlistEntry, WaitlistStatus } from '@/lib/types'

type Params = { params: Promise<{ id: string }> }

/**
 * 管理用: 順番待ちの操作
 * body: { action }
 * - call:   呼び出す（LINEでお知らせ）
 * - seat:   案内済み
 * - absent: 呼び出したが不在（取り消しにはしない。戻ってきたら return）
 * - return: 不在だったお客様が戻った → 次に空いた席へ優先して案内する
 * - cancel: 取り消し（お客様から連絡があったときなど）
 * - undo:   案内済み・取り消しを「待ち」に戻す（押し間違い用）
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { action }: { action?: string } = await req.json()
  const now = new Date().toISOString()

  const updates: Record<string, { status: WaitlistStatus } & Record<string, unknown>> = {
    call: { status: 'called', called_at: now },
    seat: { status: 'seated', seated_at: now },
    absent: { status: 'absent' },
    return: { status: 'waiting', returned_at: now },
    cancel: { status: 'canceled' },
    undo: { status: 'waiting' },
  }
  const update = action ? updates[action] : undefined
  if (!update) return NextResponse.json({ error: '操作が正しくありません' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('waitlist_entries')
    .update({ ...update, updated_at: now })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '受付が見つかりません' }, { status: 404 })

  if (action === 'call') await notifyCalled(data as WaitlistEntry)
  // 順番が動いたので、近づいた人にお知らせする
  await notifyApproaching(supabase, await getTodayEntries(supabase)).catch(() => {})

  return NextResponse.json({ ok: true })
}
