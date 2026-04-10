import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') ?? 'today' // today | week | month

  const supabase = createServiceRoleClient()

  // 期間の開始日時を計算（JST: UTC+9）
  const now = new Date()
  const jstOffset = 9 * 60 * 60 * 1000
  const nowJst = new Date(now.getTime() + jstOffset)

  let fromDate: Date
  if (range === 'week') {
    fromDate = new Date(nowJst)
    fromDate.setDate(nowJst.getDate() - 6)
    fromDate.setHours(0, 0, 0, 0)
  } else if (range === 'month') {
    fromDate = new Date(nowJst.getFullYear(), nowJst.getMonth(), 1)
  } else {
    // today
    fromDate = new Date(nowJst)
    fromDate.setHours(0, 0, 0, 0)
  }

  // JSTからUTCに戻す
  const fromUtc = new Date(fromDate.getTime() - jstOffset).toISOString()

  // 会計済み注文のみ集計
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      table_id,
      party_size,
      order_items (
        id,
        unit_price,
        quantity,
        with_topping,
        lunch_plate_index,
        product:products ( id, name, category )
      )
    `)
    .eq('status', 'paid')
    .gte('created_at', fromUtc)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ---- サマリー集計 ----
  const TOPPING_PRICE = 50
  let totalRevenue = 0
  let orderCount = orders.length
  let totalPartySize = 0

  const productMap = new Map<string, { name: string; category: string; quantity: number; revenue: number }>()
  const timeMap = new Map<string, { revenue: number; orders: number }>()

  for (const order of orders) {
    let orderRevenue = 0

    for (const item of order.order_items ?? []) {
      const toppingCost = item.with_topping ? TOPPING_PRICE : 0
      const itemRevenue = (item.unit_price + toppingCost) * item.quantity
      orderRevenue += itemRevenue

      // ランチプレート内おにぎり（unit_priceが追加料金）は商品単位で集計
      const productName = (item.product as { name?: string })?.name ?? '不明'
      const category = (item.product as { category?: string })?.category ?? ''
      const productId = (item.product as { id?: string })?.id ?? item.id

      const existing = productMap.get(productId)
      if (existing) {
        existing.quantity += item.quantity
        existing.revenue += itemRevenue
      } else {
        productMap.set(productId, { name: productName, category, quantity: item.quantity, revenue: itemRevenue })
      }
    }

    totalRevenue += orderRevenue
    totalPartySize += (order as { party_size?: number | null }).party_size ?? 0

    // 時間帯別（JSTに変換して集計）
    const createdJst = new Date(new Date(order.created_at).getTime() + jstOffset)
    let periodKey: string
    if (range === 'today') {
      // 1時間単位
      periodKey = `${String(createdJst.getHours()).padStart(2, '0')}:00`
    } else {
      // 1日単位
      periodKey = `${createdJst.getMonth() + 1}/${createdJst.getDate()}`
    }

    const existing = timeMap.get(periodKey)
    if (existing) {
      existing.revenue += orderRevenue
      existing.orders += 1
    } else {
      timeMap.set(periodKey, { revenue: orderRevenue, orders: 1 })
    }
  }

  // 商品ランキング（売上順）
  const byProduct = Array.from(productMap.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  // 時系列データ（キー昇順）
  const byTime = Array.from(timeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({ period, ...v }))

  return NextResponse.json({
    summary: {
      total_revenue: totalRevenue,
      order_count: orderCount,
      total_party_size: totalPartySize,
      avg_per_order: orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
      avg_per_person: totalPartySize > 0 ? Math.round(totalRevenue / totalPartySize) : null,
    },
    by_time: byTime,
    by_product: byProduct,
  })
}
