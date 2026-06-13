import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

const JST = 9 * 60 * 60 * 1000
const TOPPING_PRICE = 50
const COMPETITOR_REDUCED_FACTOR = 1.12
const EVENT_SCALE_FACTORS = [1.0, 1.03, 1.07, 1.12, 1.20, 1.30] // index = scale 0-5

type ForecastMap = Map<string, { main: string; desc: string; temp_max: number; temp_min: number }>

async function fetchForecast(): Promise<ForecastMap> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY
  if (!apiKey) return new Map()
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=Sendai,JP&appid=${apiKey}&units=metric&lang=ja&cnt=40`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return new Map()
    const data = await res.json()

    type FItem = { dt: number; main: { temp: number }; weather: { main: string; description: string }[] }
    const raw = new Map<string, { counts: Record<string, number>; descs: Record<string, string>; temps: number[] }>()

    for (const item of (data.list ?? []) as FItem[]) {
      const d = new Date(item.dt * 1000 + JST)
      const ds = d.toISOString().slice(0, 10)
      if (!raw.has(ds)) raw.set(ds, { counts: {}, descs: {}, temps: [] })
      const r = raw.get(ds)!
      r.temps.push(item.main.temp)
      const m = item.weather[0]?.main ?? 'Clear'
      r.counts[m] = (r.counts[m] ?? 0) + 1
      if (!r.descs[m]) r.descs[m] = item.weather[0]?.description ?? m
    }

    const result: ForecastMap = new Map()
    for (const [ds, r] of raw.entries()) {
      const main = Object.entries(r.counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Clear'
      result.set(ds, {
        main,
        desc: r.descs[main] ?? main,
        temp_max: Math.max(...r.temps),
        temp_min: Math.min(...r.temps),
      })
    }
    return result
  } catch {
    return new Map()
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const nowJst   = new Date(Date.now() + JST)
  const year     = parseInt(searchParams.get('year')  ?? String(nowJst.getFullYear()))
  const month    = parseInt(searchParams.get('month') ?? String(nowJst.getMonth() + 1))
  const todayStr = nowJst.toISOString().slice(0, 10)

  const supabase = createServiceRoleClient()

  const firstDay    = new Date(year, month - 1, 1)
  const lastDayNum  = new Date(year, month, 0).getDate()
  const pad         = (n: number) => String(n).padStart(2, '0')
  const fromDateStr = `${year}-${pad(month)}-01`
  const toDateStr   = `${year}-${pad(month)}-${pad(lastDayNum)}`
  const fromUtc     = new Date(firstDay.getTime() - JST).toISOString()
  const toUtc       = new Date(new Date(year, month, 1).getTime() - JST).toISOString()

  // Historical baseline: 6 months before this month
  const histFrom    = new Date(year, month - 7, 1)
  const histFromStr = `${histFrom.getFullYear()}-${pad(histFrom.getMonth() + 1)}-01`
  const histFromUtc = new Date(histFrom.getTime() - JST).toISOString()

  const [
    ordersRes, weatherRes, shopsRes, overridesRes, eventsRes,
    histOrdersRes, histWeatherRes, forecast,
  ] = await Promise.all([
    supabase.from('orders')
      .select('created_at, order_items(unit_price, quantity, with_topping)')
      .eq('status', 'paid').gte('created_at', fromUtc).lt('created_at', toUtc),
    supabase.from('weather_log')
      .select('date, temp_max, temp_min, weather_main, weather_desc')
      .gte('date', fromDateStr).lte('date', toDateStr),
    supabase.from('competitor_shops').select('id, name, open_weekdays').eq('is_active', true).order('created_at'),
    supabase.from('competitor_status_log').select('shop_id, date, is_open')
      .gte('date', fromDateStr).lte('date', toDateStr),
    supabase.from('sendai_events').select('id, name, date, end_date, scale')
      .gte('date', fromDateStr).lte('date', toDateStr),
    supabase.from('orders')
      .select('created_at, order_items(unit_price, quantity, with_topping)')
      .eq('status', 'paid').gte('created_at', histFromUtc).lt('created_at', fromUtc),
    supabase.from('weather_log').select('date, weather_main')
      .gte('date', histFromStr).lt('date', fromDateStr),
    fetchForecast(),
  ])

  if (ordersRes.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 500 })

  // ── Daily revenue for this month ──
  type OrderRow = { created_at: string; order_items: { unit_price: number; quantity: number; with_topping: boolean }[] }
  function calcRevenue(items: { unit_price: number; quantity: number; with_topping: boolean }[]) {
    return items.reduce((s, i) => s + (i.unit_price + (i.with_topping ? TOPPING_PRICE : 0)) * i.quantity, 0)
  }

  const dailyRev = new Map<string, { revenue: number; orders: number }>()
  for (const o of (ordersRes.data ?? []) as OrderRow[]) {
    const ds = new Date(new Date(o.created_at).getTime() + JST).toISOString().slice(0, 10)
    const rev = calcRevenue(o.order_items ?? [])
    const ex = dailyRev.get(ds)
    if (ex) { ex.revenue += rev; ex.orders++ } else dailyRev.set(ds, { revenue: rev, orders: 1 })
  }

  // ── Historical daily revenue ──
  const histDailyRev = new Map<string, number>()
  for (const o of (histOrdersRes.data ?? []) as OrderRow[]) {
    const ds = new Date(new Date(o.created_at).getTime() + JST).toISOString().slice(0, 10)
    histDailyRev.set(ds, (histDailyRev.get(ds) ?? 0) + calcRevenue(o.order_items ?? []))
  }
  // include current month past days in baseline
  for (const [ds, v] of dailyRev.entries()) {
    if (ds <= todayStr) histDailyRev.set(ds, v.revenue)
  }

  // ── Weekday averages ──
  const wdTotals = new Map<number, { total: number; count: number }>()
  for (const [ds, rev] of histDailyRev.entries()) {
    const dow = new Date(ds).getUTCDay()
    const ex = wdTotals.get(dow)
    if (ex) { ex.total += rev; ex.count++ } else wdTotals.set(dow, { total: rev, count: 1 })
  }
  const weekdayAvg = new Map<number, number>()
  for (const [dow, { total, count }] of wdTotals.entries()) {
    weekdayAvg.set(dow, count > 0 ? Math.round(total / count) : 0)
  }
  const overallTotal = [...wdTotals.values()].reduce((s, v) => s + v.total, 0)
  const overallCount = [...wdTotals.values()].reduce((s, v) => s + v.count, 0)
  const overallAvg   = overallCount > 0 ? overallTotal / overallCount : 0

  // ── Weather factor from history ──
  const wCorrMap = new Map<string, { total: number; count: number }>()
  for (const w of (histWeatherRes.data ?? []) as { date: string; weather_main: string | null }[]) {
    if (!w.weather_main) continue
    const rev = histDailyRev.get(w.date) ?? 0
    const ex = wCorrMap.get(w.weather_main)
    if (ex) { ex.total += rev; ex.count++ } else wCorrMap.set(w.weather_main, { total: rev, count: 1 })
  }
  const weatherFactor = new Map<string, number>()
  if (overallAvg > 0) {
    for (const [main, { total, count }] of wCorrMap.entries()) {
      weatherFactor.set(main, count > 0 ? (total / count) / overallAvg : 1.0)
    }
  }

  // ── Competitor status helpers ──
  const shops = shopsRes.data ?? []
  const overrideMap = new Map<string, Map<string, boolean>>()
  for (const o of (overridesRes.data ?? []) as { shop_id: string; date: string; is_open: boolean }[]) {
    if (!overrideMap.has(o.shop_id)) overrideMap.set(o.shop_id, new Map())
    overrideMap.get(o.shop_id)!.set(o.date, o.is_open)
  }

  function getCompStatus(ds: string) {
    const dow = new Date(ds).getUTCDay()
    let openCount = 0
    let reducedCompetition = false
    const shopStatus = shops.map((shop) => {
      const defaultOpen = (shop.open_weekdays as number[]).includes(dow)
      const override    = overrideMap.get(shop.id)?.get(ds)
      const isOpen      = override !== undefined ? override : defaultOpen
      if (isOpen) openCount++
      if (defaultOpen && !isOpen) reducedCompetition = true
      return { id: shop.id, name: shop.name, is_open: isOpen }
    })
    return { open_count: openCount, total: shops.length, reduced_competition: reducedCompetition, shop_status: shopStatus }
  }

  // ── Events by date (expand multi-day) ──
  const eventsByDate = new Map<string, { name: string; scale: number }[]>()
  for (const e of (eventsRes.data ?? []) as { name: string; date: string; end_date: string | null; scale: number }[]) {
    const end = e.end_date ?? e.date
    const cur = new Date(e.date)
    const endD = new Date(end)
    while (cur <= endD) {
      const ds = cur.toISOString().slice(0, 10)
      if (ds >= fromDateStr && ds <= toDateStr) {
        if (!eventsByDate.has(ds)) eventsByDate.set(ds, [])
        eventsByDate.get(ds)!.push({ name: e.name, scale: e.scale })
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  // ── Weather by date ──
  const weatherByDate = new Map<string, { main: string; desc: string | null; temp_max: number | null; temp_min: number | null }>()
  for (const w of (weatherRes.data ?? []) as { date: string; weather_main: string | null; weather_desc: string | null; temp_max: number | null; temp_min: number | null }[]) {
    if (w.weather_main) weatherByDate.set(w.date, { main: w.weather_main, desc: w.weather_desc, temp_max: w.temp_max, temp_min: w.temp_min })
  }

  // ── Build calendar days ──
  const DOW_JP = ['日', '月', '火', '水', '木', '金', '土']
  const days = []
  let totalActual = 0
  let totalPredicted = 0
  let pastDaysCount = 0
  let predErrSum = 0
  let predErrCount = 0

  for (let d = 1; d <= lastDayNum; d++) {
    const ds    = `${year}-${pad(month)}-${pad(d)}`
    const dow   = new Date(ds).getUTCDay()
    const isFuture = ds > todayStr
    const isToday  = ds === todayStr

    const actual  = dailyRev.get(ds)
    const wActual = weatherByDate.get(ds) ?? null
    const wFcast  = (isFuture || isToday) ? (forecast.get(ds) ?? null) : null
    const comp    = getCompStatus(ds)
    const events  = eventsByDate.get(ds) ?? []
    const maxScale = events.length > 0 ? Math.max(...events.map((e) => e.scale)) : 0

    // Prediction
    const base      = weekdayAvg.get(dow) ?? Math.round(overallAvg)
    const wMain     = isFuture ? wFcast?.main : wActual?.main
    const wFactor   = wMain ? (weatherFactor.get(wMain) ?? 1.0) : 1.0
    const cFactor   = comp.reduced_competition ? COMPETITOR_REDUCED_FACTOR : 1.0
    const eFactor   = EVENT_SCALE_FACTORS[Math.min(maxScale, 5)] ?? 1.0
    const predicted = base > 0 ? Math.round(base * wFactor * cFactor * eFactor) : null

    // vs weekday avg %
    const vsAvgPct = actual && base > 0 ? Math.round(((actual.revenue - base) / base) * 100) : null

    if (!isFuture) {
      if (actual) {
        totalActual += actual.revenue
        pastDaysCount++
        if (predicted) {
          predErrSum += Math.abs(actual.revenue - predicted) / predicted
          predErrCount++
        }
      }
      if (predicted) totalPredicted += predicted
    } else {
      if (predicted) totalPredicted += predicted
    }

    days.push({
      date: ds,
      dow,
      dow_label: DOW_JP[dow],
      is_today: isToday,
      is_future: isFuture,
      actual_revenue:   actual?.revenue ?? null,
      order_count:      actual?.orders  ?? null,
      weather_actual:   wActual,
      weather_forecast: wFcast,
      competitor_status: comp,
      events,
      max_event_scale: maxScale,
      predicted_revenue: predicted,
      vs_avg_pct: vsAvgPct,
    })
  }

  const weekdayBaselines = DOW_JP.map((label, dow) => {
    const v = wdTotals.get(dow)
    return { dow, label, avg: v ? Math.round(v.total / v.count) : 0, count: v?.count ?? 0 }
  })

  const predictionAccuracyPct = predErrCount >= 3
    ? Math.round((1 - predErrSum / predErrCount) * 100)
    : null

  return NextResponse.json({
    days,
    weekday_baselines: weekdayBaselines,
    month_summary: {
      total_actual:     totalActual,
      total_predicted:  totalPredicted,
      past_days_count:  pastDaysCount,
      prediction_accuracy_pct: predictionAccuracyPct,
    },
  })
}
