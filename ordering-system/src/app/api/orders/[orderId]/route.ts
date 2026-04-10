import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/lib/types'
import { onOrderCompleted } from '@/lib/line-tags'

interface Params {
  params: Promise<{ orderId: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      table:tables(*),
      order_items(
        *,
        product:products(*)
      )
    `)
    .eq('id', orderId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orderId } = await params
  const body: { status: OrderStatus } = await req.json()

  const validStatuses: OrderStatus[] = ['new', 'preparing', 'served', 'paid']
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // ステータス更新前に現在の注文を取得（LINE連携用）
  const { data: currentOrder } = await supabase
    .from('orders')
    .select('line_user_id, table_id, status')
    .eq('id', orderId)
    .single()

  const { data, error } = await supabase
    .from('orders')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 【自動化②〜④】注文完了（paid）時にLINEタグを更新
  if (
    body.status === 'paid' &&
    currentOrder?.status !== 'paid' && // 二重更新防止
    currentOrder?.line_user_id
  ) {
    const tableId = currentOrder.table_id ?? ''
    // takeout テーブルIDは 'takeout' という値
    const orderType = tableId === 'takeout' ? 'takeout' : 'eatin'

    await onOrderCompleted(supabase, currentOrder.line_user_id, orderType)
  }

  return NextResponse.json(data)
}
