import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

function toJstTime(isoStr: string): string {
  const d = new Date(new Date(isoStr).getTime() + 9 * 60 * 60 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') ?? 'today' // today | week | month

  const supabase = createServiceRoleClient()

  const jstOffset = 9 * 60 * 60 * 1000
  const now = new Date()
  const nowJst = new Date(now.getTime() + jstOffset)
  const todayJst = nowJst.toISOString().slice(0, 10)

  let fromDate: Date
  if (range === 'week') {
    fromDate = new Date(nowJst)
    fromDate.setDate(nowJst.getDate() - 6)
    fromDate.setHours(0, 0, 0, 0)
  } else if (range === 'month') {
    fromDate = new Date(nowJst.getFullYear(), nowJst.getMonth(), 1)
  } else {
    fromDate = new Date(nowJst)
    fromDate.setHours(0, 0, 0, 0)
  }

  const fromUtc = new Date(fromDate.getTime() - jstOffset).toISOString()
  const fromDateJst = fromDate.toISOString().slice(0, 10)

  // 前期の範囲（today→同時刻昨日、week/month→同期間ひとつ前）
  let prevFromUtc: string
  let prevToUtc: string
  if (range === 'today') {
    const oneDayMs = 24 * 60 * 60 * 1000
    prevFromUtc = new Date(new Date(fromUtc).getTime() - oneDayMs).toISOString()
    prevToUtc = new Date(now.getTime() - oneDayMs).toISOString()
  } else {
    const currentFromMs = new Date(fromUtc).getTime()
    const periodDurationMs = now.getTime() - currentFromMs
    prevFromUtc = new Date(currentFromMs - periodDurationMs).toISOString()
    prevToUtc = fromUtc
  }

  const TOPPING_PRICE = 50

  const [ordersResult, soldoutResult, weatherResult, prevOrdersResult] = await Promise.all([
    supabase
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
      .order('created_at', { ascending: true }),

    supabase
      .from('product_soldout_log')
      .select('product_id, product_name, sold_out_at, date')
      .gte('date', fromDateJst)
      .lte('date', todayJst)
      .order('sold_out_at', { ascending: true }),

    supabase
      .from('weather_log')
      .select('date, temp_max, temp_min, temp_avg, weather_main, weather_desc, icon, precipitation')
      .gte('date', fromDateJst)
      .lte('date', todayJst)
      .order('date', { ascending: true }),

    supabase
      .from('orders')
      .select('id, party_size, order_items(unit_price, quantity, with_topping)')
      .eq('status', 'paid')
      .gte('created_at', prevFromUtc)
      .lt('created_at', prevToUtc),
  ])

  if (ordersResult.error) {
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 })
  }

  const orders = ordersResult.data
  let totalRevenue = 0
  const orderCount = orders.length
  let totalPartySize = 0

  const productMap = new Map<string, { name: string; category: string; quantity: number; revenue: number }>()
  const timeMap = new Map<string, { revenue: number; orders: number }>()

  for (const order of orders) {
    let orderRevenue = 0

    for (const item of order.order_items ?? []) {
      const toppingCost = item.with_topping ? TOPPING_PRICE : 0
      const itemRevenue = (item.unit_price + toppingCost) * item.quantity
      orderRevenue += itemRevenue

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

    const createdJst = new Date(new Date(order.created_at).getTime() + jstOffset)
    let periodKey: string
    if (range === 'today') {
      periodKey = `${String(createdJst.getUTCHours()).padStart(2, '0')}:00`
    } else {
      periodKey = `${createdJst.getUTCMonth() + 1}/${createdJst.getUTCDate()}`
    }

    const existing = timeMap.get(periodKey)
    if (existing) {
      existing.revenue += orderRevenue
      existing.orders += 1
    } else {
      timeMap.set(periodKey, { revenue: orderRevenue, orders: 1 })
    }
  }

  // 前期サマリー
  let prevRevenue = 0
  let prevOrderCount = 0
  for (const order of prevOrdersResult.data ?? []) {
    prevOrderCount++
    for (const item of (order as { order_items?: { unit_price: number; quantity: number; with_topping: boolean }[] }).order_items ?? []) {
      const tc = item.with_topping ? TOPPING_PRICE : 0
      prevRevenue += (item.unit_price + tc) * item.quantity
    }
  }

  // 天気×売上相関（week/month のみ）
  const weatherCorrMap = new Map<string, { totalRevenue: number; days: number; label: string }>()
  if (range !== 'today') {
    for (const w of weatherResult.data ?? []) {
      if (!w.weather_main) continue
      const [, m, d] = w.date.split('-')
      const key = `${parseInt(m)}/${parseInt(d)}`
      const dayRevenue = timeMap.get(key)?.revenue ?? 0
      const ex = weatherCorrMap.get(w.weather_main)
      if (ex) {
        ex.totalRevenue += dayRevenue
        ex.days++
      } else {
        weatherCorrMap.set(w.weather_main, { totalRevenue: dayRevenue, days: 1, label: w.weather_desc ?? w.weather_main })
      }
    }
  }
  const weatherCorrelation = Array.from(weatherCorrMap.entries())
    .map(([main, v]) => ({
      weather_main: main,
      label: v.label,
      avg_revenue: Math.round(v.totalRevenue / v.days),
      days: v.days,
    }))
    .sort((a, b) => b.avg_revenue - a.avg_revenue)

  const byProduct = Array.from(productMap.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  const byTime = Array.from(timeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({ period, ...v }))

  const soldoutLogs = (soldoutResult.data ?? []).map((entry) => ({
    ...entry,
    time: toJstTime(entry.sold_out_at),
  }))

  return NextResponse.json({
    summary: {
      total_revenue: totalRevenue,
      order_count: orderCount,
      total_party_size: totalPartySize,
      avg_per_order: orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
      avg_per_person: totalPartySize > 0 ? Math.round(totalRevenue / totalPartySize) : null,
    },
    prev_summary: {
      total_revenue: prevRevenue,
      order_count: prevOrderCount,
      avg_per_order: prevOrderCount > 0 ? Math.round(prevRevenue / prevOrderCount) : 0,
    },
    by_time: byTime,
    by_product: byProduct,
    soldout_logs: soldoutLogs,
    weather: weatherResult.data ?? [],
    weather_correlation: weatherCorrelation,
  })
}
