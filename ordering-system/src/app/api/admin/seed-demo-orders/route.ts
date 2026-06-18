import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // 商品一覧を取得
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, price, category')
    .order('sort_order', { ascending: true })

  if (prodError || !products || products.length === 0) {
    return NextResponse.json({ error: '商品取得失敗: ' + prodError?.message }, { status: 500 })
  }

  const nonDrinkProducts = products.filter((p) => p.category !== 'ドリンク')
  const allProducts = products

  const tableIds = [
    'table-1', 'table-2', 'table-3', 'table-4',
    'counter-1', 'counter-2', 'counter-3', 'counter-4',
  ]

  const now = Date.now()
  const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000

  // 60日間をほぼ均等に分割して40件の注文時刻を生成（ランダムなばらつきあり）
  const orderTimes: number[] = []
  for (let i = 0; i < 40; i++) {
    const base = twoMonthsAgo + (i / 40) * (now - twoMonthsAgo)
    // ±1日のランダムオフセット
    const jitter = (Math.random() - 0.5) * 2 * 24 * 60 * 60 * 1000
    const t = Math.max(twoMonthsAgo, Math.min(now - 60000, base + jitter))
    // 営業時間帯（10:00–19:00 JST）にクランプ
    const d = new Date(t)
    const jstHour = (d.getUTCHours() + 9) % 24
    if (jstHour < 10) d.setUTCHours(d.getUTCHours() + (10 - jstHour))
    if (jstHour >= 19) d.setUTCHours(d.getUTCHours() - (jstHour - 17))
    orderTimes.push(d.getTime())
  }
  orderTimes.sort((a, b) => a - b)

  const createdOrders: string[] = []
  const errors: string[] = []

  for (let i = 0; i < 40; i++) {
    const isTakeout = i % 2 === 0  // 偶数インデックス = テイクアウト（20件ずつ）
    const createdAt = new Date(orderTimes[i]).toISOString()

    const tableId = isTakeout
      ? 'takeout'
      : tableIds[i % tableIds.length]

    let pickupAt: string | null = null
    if (isTakeout) {
      // 注文から30〜90分後を受取時刻に設定
      const pickup = new Date(orderTimes[i] + (30 + Math.floor(Math.random() * 60)) * 60000)
      const jstPickup = new Date(pickup.getTime() + 9 * 3600000)
      pickupAt = jstPickup.toISOString().slice(0, 16).replace('T', ' ')
    }

    // 注文に含める商品を1〜3品ランダム選択
    const pool = isTakeout ? nonDrinkProducts : allProducts
    const itemCount = 1 + Math.floor(Math.random() * 3)
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(itemCount, pool.length))

    const orderData: Record<string, unknown> = {
      table_id: tableId,
      status: 'paid',
      created_at: createdAt,
      updated_at: createdAt,
    }
    if (pickupAt) orderData.pickup_at = pickupAt

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single()

    if (orderError || !order) {
      errors.push(`order ${i}: ${orderError?.message}`)
      continue
    }

    const items = shuffled.map((p) => ({
      order_id: order.id,
      product_id: p.id,
      quantity: 1 + Math.floor(Math.random() * 2),
      unit_price: p.price,
      with_topping: false,
    }))

    const { error: itemError } = await supabase.from('order_items').insert(items)
    if (itemError) {
      errors.push(`items for order ${order.id}: ${itemError.message}`)
    } else {
      createdOrders.push(order.id)
    }
  }

  return NextResponse.json({
    created: createdOrders.length,
    errors,
  })
}
