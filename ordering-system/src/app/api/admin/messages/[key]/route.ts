import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { todayJST } from '@/lib/business-hours'

interface Params {
  params: Promise<{ key: string }>
}

/** 1通の文章の上限（LINEの上限は5000文字） */
const MAX_TEXT = 2000

/**
 * 管理用: 来店後のLINEメッセージの設定を保存する
 * body: { name?, enabled?, days_after?, min_interval_days?, text?, image_url?, preview_url? }
 * 送らない→送るにしたときは、その日を enabled_from にする（その日より後に送る予定の分から送る）
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { key } = await params
  const body: {
    name?: string
    enabled?: boolean
    days_after?: number
    min_interval_days?: number | null
    text?: string
    image_url?: string | null
    preview_url?: string | null
  } = await req.json().catch(() => ({}))

  const supabase = createServiceRoleClient()
  const { data: current } = await supabase.from('line_message_rules').select('enabled').eq('key', key).maybeSingle()
  if (!current) return NextResponse.json({ error: 'メッセージが見つかりません' }, { status: 404 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 40)
    if (!name) return NextResponse.json({ error: 'メッセージの名前を入れてください' }, { status: 400 })
    updates.name = name
  }
  if (typeof body.enabled === 'boolean') {
    updates.enabled = body.enabled
    if (body.enabled && !current.enabled) updates.enabled_from = todayJST()
  }
  if (body.days_after !== undefined) {
    if (!Number.isInteger(body.days_after) || body.days_after < 1 || body.days_after > 365) {
      return NextResponse.json({ error: '何日後に送るかは、1〜365の数字で入れてください' }, { status: 400 })
    }
    updates.days_after = body.days_after
  }
  if (body.min_interval_days !== undefined) {
    const v = body.min_interval_days
    if (v !== null && (!Number.isInteger(v) || v < 1 || v > 365)) {
      return NextResponse.json({ error: '送らない日数は、1〜365の数字か空欄にしてください' }, { status: 400 })
    }
    updates.min_interval_days = v
  }
  if (body.text !== undefined) {
    const text = String(body.text).trim()
    if (!text) return NextResponse.json({ error: 'メッセージの文章を入れてください' }, { status: 400 })
    if (text.length > MAX_TEXT) return NextResponse.json({ error: `文章は${MAX_TEXT}文字以内にしてください` }, { status: 400 })
    updates.text = text
  }
  if (body.image_url !== undefined) {
    const url = body.image_url ? String(body.image_url) : null
    if (url && !url.startsWith('https://')) {
      return NextResponse.json({ error: '画像は https:// から始まるURLにしてください' }, { status: 400 })
    }
    updates.image_url = url
    updates.preview_url = url ? (body.preview_url ? String(body.preview_url) : url) : null
  }

  const { data, error } = await supabase.from('line_message_rules').update(updates).eq('key', key).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** 管理用: メッセージを削除する（送った記録は残す） */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { key } = await params
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('line_message_rules').delete().eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
