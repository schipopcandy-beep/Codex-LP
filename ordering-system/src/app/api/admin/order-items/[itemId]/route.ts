import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getLunchPlateSurcharge, isToppingSelectable, type Product } from '@/lib/types'
import { checkStock, stockDateFor, syncAutoSoldOut } from '@/lib/stock'

interface Params {
  params: Promise<{ itemId: string }>
}

interface ItemRow {
  id: string
  order_id: string
  product_id: string
  quantity: number
  lunch_plate_index: number | null
  order: { id: string; table_id: string; pickup_at: string | null; created_at: string } | null
}

async function loadItem(itemId: string) {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, quantity, lunch_plate_index, order:orders(id, table_id, pickup_at, created_at)')
    .eq('id', itemId)
    .maybeSingle()
  return { supabase, item: data as unknown as ItemRow | null }
}

/**
 * 管理用: 注文明細を修正する（お客様の注文ミスへの対応）
 * body: { quantity?, product_id?, with_topping?, with_egg_yolk? }
 * - product_id の変更は、ランチプレートの中のおにぎりだけ（追加料金も付け直す）
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { itemId } = await params
  const body: {
    quantity?: number
    product_id?: string
    with_topping?: boolean
    with_egg_yolk?: boolean
  } = await req.json()

  const { supabase, item } = await loadItem(itemId)
  if (!item || !item.order) return NextResponse.json({ error: '明細が見つかりません' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  const requested = new Map<string, number>()
  let productId = item.product_id
  let quantity = item.quantity

  if (body.quantity !== undefined) {
    if (!Number.isInteger(body.quantity) || body.quantity < 1) {
      return NextResponse.json({ error: '個数は1以上で指定してください（なくす場合は削除）' }, { status: 400 })
    }
    quantity = body.quantity
    updates.quantity = quantity
  }

  if (body.product_id && body.product_id !== item.product_id) {
    if (item.lunch_plate_index == null) {
      return NextResponse.json({ error: '商品を入れ替えられるのはランチプレートのおにぎりだけです' }, { status: 400 })
    }
    const { data: product } = await supabase.from('products').select('*').eq('id', body.product_id).maybeSingle()
    if (!product || !isToppingSelectable(product as Product)) {
      return NextResponse.json({ error: 'おにぎりを選んでください' }, { status: 400 })
    }
    productId = body.product_id
    updates.product_id = productId
    updates.unit_price = getLunchPlateSurcharge(product as Product)
  }

  if (typeof body.with_topping === 'boolean') updates.with_topping = body.with_topping
  if (typeof body.with_egg_yolk === 'boolean') updates.with_egg_yolk = body.with_egg_yolk
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  // 増える分だけ残り数を確認する（商品を入れ替えた場合は、入れ替え先の全数）
  if (productId !== item.product_id) requested.set(productId, quantity)
  else if (quantity > item.quantity) requested.set(productId, quantity - item.quantity)
  if (requested.size > 0) {
    const shortage = await checkStock(supabase, stockDateFor(item.order), requested)
    if (shortage) return NextResponse.json({ error: shortage }, { status: 409 })
  }

  const { error } = await supabase.from('order_items').update(updates).eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('orders').update({ updated_at: new Date().toISOString() }).eq('id', item.order_id)
  await syncAutoSoldOut(supabase).catch(() => {})
  return NextResponse.json({ ok: true })
}

/** 管理用: 注文明細を削除する */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { itemId } = await params
  const { supabase, item } = await loadItem(itemId)
  if (!item) return NextResponse.json({ error: '明細が見つかりません' }, { status: 404 })

  const { error } = await supabase.from('order_items').delete().eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('orders').update({ updated_at: new Date().toISOString() }).eq('id', item.order_id)
  // 削除で残りが戻った商品は、自動で売り切れにしていれば販売中に戻す
  await syncAutoSoldOut(supabase).catch(() => {})
  return NextResponse.json({ ok: true })
}
