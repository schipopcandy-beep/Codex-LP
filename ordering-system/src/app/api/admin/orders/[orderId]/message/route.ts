import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendLineMessage } from '@/lib/line-message'

/** 1通に入れられる文字数（LINEの上限は5000文字） */
const MAX_LENGTH = 1000

interface Params {
  params: Promise<{ orderId: string }>
}

/**
 * 管理用: 注文したお客様にLINEを送る（注文カードの「LINEで連絡」）
 * body: { text }
 * 送れたかどうかにかかわらず記録を残す（友だちでない・ブロック中だと送れない）
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params
  const body: { text?: unknown } = await req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: '送る文章を入れてください' }, { status: 400 })
  if (text.length > MAX_LENGTH) {
    return NextResponse.json({ error: `${MAX_LENGTH}文字以内にしてください` }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: order } = await supabase.from('orders').select('id, line_user_id').eq('id', orderId).maybeSingle()
  if (!order) return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 })
  if (!order.line_user_id) {
    return NextResponse.json({ error: 'この注文はLINEから注文されていないため、LINEを送れません' }, { status: 400 })
  }

  const ok = await sendLineMessage(order.line_user_id, text).catch(() => false)
  const { data: record, error } = await supabase
    .from('order_messages')
    .insert({ order_id: orderId, text, ok })
    .select()
    .single()
  if (error) console.error('LINEの送信記録を残せませんでした:', error.message)

  if (!ok) {
    return NextResponse.json(
      { error: '送れませんでした。お客様がお店のLINEを友だち追加していないか、ブロックしている可能性があります', message: record },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, message: record })
}
