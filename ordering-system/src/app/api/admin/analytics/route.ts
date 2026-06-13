import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

function toJstTime(isoStr: string): string {
  const d = new Date(new Date(isoStr).getTime() + 9 * 60 * 60 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') ?? 'today' // today | week | history

  const supabase = createServiceRoleClient()

  const jstOffset = 9 * 60 * 60 * 1000
  const now = new Date()
  const nowJst = new Date(now.getTime() + jstOffset)
  const todayJst = nowJst.toISOString().slice(0, 10)

  let fromDate: Date
  let toDate: Date | null = null

  if (range === 'week') {
    fromDate = new Date(nowJst)
    fromDate.setDate(nowJst.getDate() - 6)
    fromDate.setHours(0, 0, 0, 0)
  } else if (range === 'history') {
    const histYear  = parseInt(searchParams.get('year')  ?? String(nowJst.getFullYear()))
    const histMonth = parseInt(searchParams.get('month') ?? String(nowJst.getMonth() + 1))
    fromDate = new Date(histYear, histMonth - 1, 1)
    toDate   = new Date(histYear, histMonth, 1)
  } else {
    fromDate = new Date(nowJst)
    fromDate.setHours(0, 0, 0, 0)
  }

  const fromUtc     = new Date(fromDate.getTime() - jstOffset).toISOString()
  const toUtc       = toDate ? new Date(toDate.getTime() - jstOffset).toISOString() : null
  const fromDateJst = fromDate.toISOString().slice(0, 10)
  const toDateJst   = toDate
    ? new Date(toDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : todayJst

  // 前期の範囲
  let prevFromUtc: string
  let prevToUtc: string
  if (range === 'today') {
    const oneDayMs = 24 * 60 * 60 * 1000
    prevFromUtc = new Date(new Date(fromUtc).getTime() - oneDayMs).toISOString()
    prevToUtc   = new Date(now.getTime() - oneDayMs).toISOString()
  } else if (range === 'history') {
    const histYear  = parseInt(searchParams.get('year')  ?? String(nowJst.getFullYear()))
    const histMonth = parseInt(searchParams.get('month') ?? String(nowJst.getMonth() + 1))
    prevFromUtc = new Date(new Date(histYear, histMonth - 2, 1).getTime() - jstOffset).toISOString()
    prevToUtc   = new Date(new Date(histYear, histMonth - 1, 1).getTime() - jstOffset).toISOString()
  } else {
    const currentFromMs    = new Date(fromUtc).getTime()
    const periodDurationMs = now.getTime() - currentFromMs
    prevFromUtc = new Date(currentFromMs - periodDurationMs).toISOString()
    prevToUtc   = fromUtc
  }

  const TOPPING_PRICE = 50

  let ordersQuery = supabase
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
  if (toUtc) ordersQuery = ordersQuery.lt('created_at', toUtc)

  let soldoutQuery = supabase
    .from('product_soldout_log')
    .select('product_id, product_name, sold_out_at, date')
    .gte('date', fromDateJst)
    .lte('date', toDateJst)
    .order('sold_out_at', { ascending: true })

  let weatherQuery = supabase
    .from('weather_log')
    .select('date, temp_max, temp_min, temp_avg, weather_main, weather_desc, icon, precipitation')
    .gte('date', fromDateJst)
    .lte('date', toDateJst)
    .order('date', { ascending: true })

  const [
    ordersResult, soldoutResult, weatherResult, prevOrdersResult,
    shopsResult, statusOverridesResult, eventsResult,
  ] = await Promise.all([
    ordersQuery,
    soldoutQuery,
    weatherQuery,
    supabase
      .from('orders')
      .select('id, party_size, order_items(unit_price, quantity, with_topping)')
      .eq('status', 'paid')
      .gte('created_at', prevFromUtc)
      .lt('created_at', prevToUtc),
    supabase.from('competitor_shops').select('id, name, open_weekdays').eq('is_active', true).order('created_at'),
    supabase.from('competitor_status_log').select('shop_id, date, is_open').gte('date', fromDateJst).lte('date', toDateJst),
    supabase.from('sendai_events').select('id, name, date, end_date, location, scale').gte('date', fromDateJst).lte('date', toDateJst).order('date'),
  ])

  if (ordersResult.error) {
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 })
  }

  const orders = ordersResult.data
  let totalRevenue = 0
  const orderCount = orders.length
  let totalPartySize = 0

  const productMap = new Map<string, { name: string; category: string; quantity: number; revenue: number }>()
  const timeMap    = new Map<string, { revenue: number; orders: number }>()
  const dateMap    = new Map<string, string>() // period → "YYYY-MM-DD"

  for (const order of orders) {
    let orderRevenue = 0

    for (const item of order.order_items ?? []) {
      const toppingCost = item.with_topping ? TOPPING_PRICE : 0
      const itemRevenue = (item.unit_price + toppingCost) * item.quantity
      orderRevenue += itemRevenue

      const productName = (item.product as { name?: string })?.name ?? '不明'
      const category    = (item.product as { category?: string })?.category ?? ''
      const productId   = (item.product as { id?: string })?.id ?? item.id

      const existing = productMap.get(productId)
      if (existing) {
        existing.quantity += item.quantity
        existing.revenue  += itemRevenue
      } else {
        productMap.set(productId, { name: productName, category, quantity: item.quantity, revenue: itemRevenue })
      }
    }

    totalRevenue  += orderRevenue
    totalPartySize += (order as { party_size?: number | null }).party_size ?? 0

    const createdJst = new Date(new Date(order.created_at).getTime() + jstOffset)
    const periodKey  = range === 'today'
      ? `${String(createdJst.getUTCHours()).padStart(2, '0')}:00`
      : `${createdJst.getUTCMonth() + 1}/${createdJst.getUTCDate()}`
    const fullDate = `${createdJst.getUTCFullYear()}-${String(createdJst.getUTCMonth() + 1).padStart(2, '0')}-${String(createdJst.getUTCDate()).padStart(2, '0')}`
    dateMap.set(periodKey, fullDate)

    const existing = timeMap.get(periodKey)
    if (existing) {
      existing.revenue += orderRevenue
      existing.orders  += 1
    } else {
      timeMap.set(periodKey, { revenue: orderRevenue, orders: 1 })
    }
  }

  // 前期サマリー
  let prevRevenue    = 0
  let prevOrderCount = 0
  for (const order of prevOrdersResult.data ?? []) {
    prevOrderCount++
    for (const item of (order as { order_items?: { unit_price: number; quantity: number; with_topping: boolean }[] }).order_items ?? []) {
      const tc = item.with_topping ? TOPPING_PRICE : 0
      prevRevenue += (item.unit_price + tc) * item.quantity
    }
  }

  // 天気×売上相関
  const weatherCorrMap = new Map<string, { totalRevenue: number; days: number; label: string }>()
  if (range !== 'today') {
    for (const w of weatherResult.data ?? []) {
      if (!w.weather_main) continue
      const [, m, d] = w.date.split('-')
      const key = `${parseInt(m)}/${parseInt(d)}`
      const dayRevenue = timeMap.get(key)?.revenue ?? 0
      const ex = weatherCorrMap.get(w.weather_main)
      if (ex) { ex.totalRevenue += dayRevenue; ex.days++ }
      else weatherCorrMap.set(w.weather_main, { totalRevenue: dayRevenue, days: 1, label: w.weather_desc ?? w.weather_main })
    }
  }
  const weatherCorrelation = Array.from(weatherCorrMap.entries())
    .map(([main, v]) => ({ weather_main: main, label: v.label, avg_revenue: Math.round(v.totalRevenue / v.days), days: v.days }))
    .sort((a, b) => b.avg_revenue - a.avg_revenue)

  // 曜日別平均（today 以外）
  const DOW_JP = ['日', '月', '火', '水', '木', '金', '土']
  const weekdayMap = new Map<number, { total: number; days: number }>()
  if (range !== 'today') {
    for (const [period, v] of timeMap.entries()) {
      const fullDate = dateMap.get(period)
      if (!fullDate) continue
      const dow = new Date(fullDate).getUTCDay()
      const ex = weekdayMap.get(dow)
      if (ex) { ex.total += v.revenue; ex.days++ }
      else weekdayMap.set(dow, { total: v.revenue, days: 1 })
    }
  }
  const byWeekday = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const v = weekdayMap.get(dow)
    return { dow, label: DOW_JP[dow], count: v?.days ?? 0, avg_revenue: v ? Math.round(v.total / v.days) : 0 }
  })

  // 競合店ステータス計算
  const shops = shopsResult.data ?? []
  const overrideByShopDate = new Map<string, Map<string, boolean>>()
  for (const o of statusOverridesResult.data ?? []) {
    if (!overrideByShopDate.has(o.shop_id)) overrideByShopDate.set(o.shop_id, new Map())
    overrideByShopDate.get(o.shop_id)!.set(o.date as string, o.is_open)
  }

  const getShopStatus = (dateStr: string) => {
    const dow = new Date(dateStr).getUTCDay()
    let openCount = 0
    let reducedCompetition = false
    const closedNames: string[] = []
    for (const shop of shops) {
      const defaultOpen = (shop.open_weekdays as number[]).includes(dow)
      const override    = overrideByShopDate.get(shop.id)?.get(dateStr)
      const isOpen      = override !== undefined ? override : defaultOpen
      if (isOpen) openCount++
      else closedNames.push(shop.name)
      if (defaultOpen && !isOpen) reducedCompetition = true
    }
    return { openCount, total: shops.length, reducedCompetition, closedNames }
  }

  // today_competitors (today のみ)
  const todayCompetitors = range === 'today'
    ? shops.map((shop) => {
        const dow = new Date(fromDateJst).getUTCDay()
        const defaultOpen = (shop.open_weekdays as number[]).includes(dow)
        const override    = overrideByShopDate.get(shop.id)?.get(fromDateJst)
        return {
          id: shop.id,
          name: shop.name,
          is_open: override !== undefined ? override : defaultOpen,
          is_override: override !== undefined,
        }
      })
    : []

  // イベントマップ
  const eventsByDate = new Map<string, Array<{ name: string; scale: number }>>()
  for (const e of eventsResult.data ?? []) {
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, [])
    eventsByDate.get(e.date)!.push({ name: e.name, scale: e.scale })
  }

  // day_context（全期間の日次コンテキスト）
  const dayContext: Record<string, { event_count: number; event_names: string[]; open_count: number; total: number; reduced_competition: boolean }> = {}
  const datesForContext = new Set<string>()
  if (range === 'today') {
    datesForContext.add(fromDateJst)
  } else {
    for (const fullDate of dateMap.values()) datesForContext.add(fullDate)
    for (const w of weatherResult.data ?? []) datesForContext.add(w.date)
  }
  for (const dateStr of datesForContext) {
    const { openCount, total, reducedCompetition } = getShopStatus(dateStr)
    const events = eventsByDate.get(dateStr) ?? []
    const [, m, d] = dateStr.split('-')
    const periodKey = range === 'today' ? 'today' : `${parseInt(m)}/${parseInt(d)}`
    dayContext[periodKey] = {
      event_count: events.length,
      event_names: events.map((e) => e.name),
      open_count: openCount,
      total,
      reduced_competition: reducedCompetition,
    }
  }

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
      total_revenue:    totalRevenue,
      order_count:      orderCount,
      total_party_size: totalPartySize,
      avg_per_order:    orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
      avg_per_person:   totalPartySize > 0 ? Math.round(totalRevenue / totalPartySize) : null,
    },
    prev_summary: {
      total_revenue: prevRevenue,
      order_count:   prevOrderCount,
      avg_per_order: prevOrderCount > 0 ? Math.round(prevRevenue / prevOrderCount) : 0,
    },
    by_time:             byTime,
    by_product:          byProduct,
    soldout_logs:        soldoutLogs,
    weather:             weatherResult.data ?? [],
    weather_correlation: weatherCorrelation,
    by_weekday:          byWeekday,
    today_competitors:   todayCompetitors,
    events_in_range:     eventsResult.data ?? [],
    day_context:         dayContext,
  })
}
