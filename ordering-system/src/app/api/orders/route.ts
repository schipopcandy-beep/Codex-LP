import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { CartItem } from '@/lib/types'
import { TOPPING_PRICE } from '@/lib/types'

interface OrderRequestBody {
  table_id: string
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    with_topping: boolean
  }>
}

export async function POST(req: NextRequest) {
  const body: OrderRequestBody = await req.json()
  const { table_id, items } = body

  if (!table_id || !items || items.length === 0) {
    return NextResponse.json(
      { error: 'table_id と items は必須です' },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  // 同じ席の未会計伝票を検索（status が paid 以外）
  const { data: existingOrder, error: fetchError } = await supabase
    .from('orders')
    .select('id')
    .eq('table_id', table_id)
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let orderId: string

  if (existingOrder) {
    // 既存の伝票に追加
    orderId = existingOrder.id

    // updated_at を更新
    await supabase
      .from('orders')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', orderId)
  } else {
    // 新しい伝票を作成
    const { data: newOrder, error: createError } = await supabase
      .from('orders')
      .insert({ table_id, status: 'new' })
      .select('id')
      .single()

    if (createError || !newOrder) {
      return NextResponse.json(
        { error: createError?.message ?? '伝票の作成に失敗しました' },
        { status: 500 },
      )
    }

    orderId = newOrder.id
  }

  // 明細を挿入
  const orderItems = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    with_topping: item.with_topping,
  }))

  const { error: insertError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ order_id: orderId }, { status: 201 })
}
