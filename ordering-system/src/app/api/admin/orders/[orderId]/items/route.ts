import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isLunchPlate, type Product } from '@/lib/types'
import { checkStock, stockDateFor, syncAutoSoldOut } from '@/lib/stock'

interface Params {
  params: Promise<{ orderId: string }>
}

/**
 * 管理用: 既存の注文に商品を追加する（お客様の注文ミスへの対応）
 * body: { product_id, quantity, with_topping?, with_egg_yolk?, is_takeout? }
 * ランチプレートは中のおにぎりと組で扱う必要があるため、ここでは追加しない
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params
  const body: {
    product_id?: string
    quantity?: number
    with_topping?: boolean
    with_egg_yolk?: boolean
    is_takeout?: boolean
  } = await req.json()

  const quantity = body.quantity ?? 1
  if (!body.product_id || !Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: '商品と1以上の個数を指定してください' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const [{ data: order }, { data: product }] = await Promise.all([
    supabase.from('orders').select('id, table_id, pickup_at, created_at').eq('id', orderId).maybeSingle(),
    supabase.from('products').select('*').eq('id', body.product_id).maybeSingle(),
  ])
  if (!order) return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 })
  if (!product) return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 })
  if (isLunchPlate(product as Product)) {
    return NextResponse.json({ error: 'ランチプレートはここからは追加できません' }, { status: 400 })
  }

  const shortage = await checkStock(supabase, stockDateFor(order), new Map([[body.product_id, quantity]]))
  if (shortage) return NextResponse.json({ error: shortage }, { status: 409 })

  const { error } = await supabase.from('order_items').insert({
    order_id: orderId,
    product_id: body.product_id,
    quantity,
    unit_price: (product as Product).price,
    with_topping: !!body.with_topping,
    with_egg_yolk: !!body.with_egg_yolk,
    is_takeout: !!body.is_takeout,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('orders').update({ updated_at: new Date().toISOString() }).eq('id', orderId)
  await syncAutoSoldOut(supabase).catch(() => {})
  return NextResponse.json({ ok: true }, { status: 201 })
}
