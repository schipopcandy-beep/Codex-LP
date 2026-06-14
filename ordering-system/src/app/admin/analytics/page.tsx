'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Range = 'today' | 'week' | 'history' | 'calendar'

interface Summary {
  total_revenue: number
  order_count: number
  total_party_size: number
  avg_per_order: number
  avg_per_person: number | null
}
interface PrevSummary { total_revenue: number; order_count: number; avg_per_order: number }
interface TimeEntry    { period: string; revenue: number; orders: number }
interface ProductEntry { id: string; name: string; category: string; quantity: number; revenue: number }
interface SoldoutEntry { product_id: string; product_name: string; sold_out_at: string; date: string; time: string }
interface WeatherEntry { date: string; temp_max: number | null; temp_min: number | null; temp_avg: number | null; weather_main: string | null; weather_desc: string | null; icon: string | null; precipitation: number }
interface WeatherCorrEntry { weather_main: string; label: string; avg_revenue: number; days: number }
interface WeekdayEntry { dow: number; label: string; count: number; avg_revenue: number }
interface CompetitorEntry { id: string; name: string; is_open: boolean; is_override: boolean }
interface EventEntry { id: string; name: string; date: string; end_date: string | null; location: string | null; scale: number }
interface DayCtx { event_count: number; event_names: string[]; open_count: number; total: number; reduced_competition: boolean }

interface AnalyticsData {
  summary: Summary
  prev_summary: PrevSummary
  by_time: TimeEntry[]
  by_product: ProductEntry[]
  soldout_logs: SoldoutEntry[]
  weather: WeatherEntry[]
  weather_correlation: WeatherCorrEntry[]
  by_weekday: WeekdayEntry[]
  today_competitors: CompetitorEntry[]
  events_in_range: EventEntry[]
  day_context: Record<string, DayCtx>
}

const WEATHER_EMOJI: Record<string, string> = {
  Clear: '☀️', Clouds: '☁️', Rain: '🌧️', Drizzle: '🌦️',
  Snow: '❄️', Thunderstorm: '⛈️', Mist: '🌫️', Fog: '🌫️', Haze: '🌫️',
}
function weatherEmoji(main: string | null): string {
  return main ? (WEATHER_EMOJI[main] ?? '🌤️') : '—'
}
function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

export default function AnalyticsPage() {
  const nowDate  = new Date()
  const nowYear  = nowDate.getFullYear()
  const nowMonth = nowDate.getMonth() + 1

  const [range, setRange]       = useState<Range>('today')
  const [histYear, setHistYear]   = useState(nowYear)
  const [histMonth, setHistMonth] = useState(nowMonth)
  const [data, setData]           = useState<AnalyticsData | null>(null)
  const [loading, setLoading]     = useState(true)

  const fetchData = useCallback(async (r: Range, year: number, month: number) => {
    setLoading(true)
    const params = r === 'history' ? `&year=${year}&month=${month}` : ''
    const res = await fetch(`/api/admin/analytics?range=${r}${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(range, histYear, histMonth) }, [range, histYear, histMonth, fetchData])

  const canGoNext = histYear < nowYear || (histYear === nowYear && histMonth < nowMonth)
  function goPrevMonth() {
    if (histMonth === 1) { setHistYear(y => y - 1); setHistMonth(12) }
    else { setHistMonth(m => m - 1) }
  }
  function goNextMonth() {
    if (!canGoNext) return
    if (histMonth === 12) { setHistYear(y => y + 1); setHistMonth(1) }
    else { setHistMonth(m => m + 1) }
  }

  const maxRevenue = data ? Math.max(...data.by_time.map((t) => t.revenue), 1) : 1
  const peakPeriod = data?.by_time.length
    ? data.by_time.reduce((p, e) => e.revenue > p.revenue ? e : p).period
    : null

  const weatherByPeriod = new Map<string, WeatherEntry>()
  if (data) {
    for (const w of data.weather) {
      const [, m, d] = w.date.split('-')
      weatherByPeriod.set(`${parseInt(m)}/${parseInt(d)}`, w)
    }
  }

  const todayWeather = data?.weather.at(-1) ?? null
  const changeLabel  = range === 'today' ? '前日比' : range === 'week' ? '前週比' : '前月比'

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-brown-500 hover:text-brown-700 text-base">← 一覧</Link>
        <h1 className="section-title text-2xl">売上分析</h1>
      </div>

      {/* 期間タブ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['today', 'week', 'history', 'calendar'] as Range[]).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl font-bold text-sm border transition-colors ${
              range === r ? 'bg-brown-600 text-white border-brown-600' : 'bg-cream-100 text-brown-700 border-cream-300 hover:bg-cream-200'
            }`}
          >
            {r === 'today' ? '今日' : r === 'week' ? '直近7日' : r === 'history' ? '履歴' : 'カレンダー'}
          </button>
        ))}
      </div>

      {/* カレンダーモード */}
      {range === 'calendar' ? <CalendarView /> : (
      <>
      {/* 履歴 月ナビ */}
      {range === 'history' && (
        <div className="flex items-center justify-between mb-5 px-1">
          <button onClick={goPrevMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-cream-200 hover:bg-cream-300 text-brown-600 font-bold">◀</button>
          <span className="font-bold text-brown-700 text-lg tabular-nums">{histYear}年{histMonth}月</span>
          <button onClick={goNextMonth} disabled={!canGoNext}
            className={`w-9 h-9 flex items-center justify-center rounded-full font-bold transition-colors ${canGoNext ? 'bg-cream-200 hover:bg-cream-300 text-brown-600' : 'bg-cream-100 text-brown-300 cursor-not-allowed'}`}
          >▶</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-brown-400 text-lg">読み込み中...</div>
      ) : !data ? (
        <div className="text-center py-20 text-brown-400">データを取得できませんでした</div>
      ) : (
        <div className="space-y-5">

          {/* 今日：天気 */}
          {range === 'today' && <WeatherCard weather={todayWeather} />}

          {/* 今日：近隣競合状況 */}
          {range === 'today' && data.today_competitors.length > 0 && (
            <CompetitorStatusCard competitors={data.today_competitors} />
          )}

          {/* サマリー */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="総売上" value={`¥${data.summary.total_revenue.toLocaleString()}`} color="text-brown-700 bg-cream-100 border-cream-300" change={pctChange(data.summary.total_revenue, data.prev_summary.total_revenue)} changeLabel={changeLabel} />
            <SummaryCard label="注文数 / 来客数" value={`${data.summary.order_count}件 / ${data.summary.total_party_size}名`} color="text-blue-700 bg-blue-50 border-blue-200" change={pctChange(data.summary.order_count, data.prev_summary.order_count)} changeLabel={changeLabel} />
            <SummaryCard label="客単価（1注文あたり）" value={`¥${data.summary.avg_per_order.toLocaleString()}`} color="text-amber-700 bg-amber-50 border-amber-200" change={pctChange(data.summary.avg_per_order, data.prev_summary.avg_per_order)} changeLabel={changeLabel} />
            <SummaryCard label="客単価（1人あたり）" value={data.summary.avg_per_person != null ? `¥${data.summary.avg_per_person.toLocaleString()}` : '—'} color="text-matcha-700 bg-matcha-50 border-matcha-200" />
          </div>

          {/* 時間帯・日別グラフ */}
          <div className="card p-4">
            <h2 className="font-bold text-brown-700 mb-4">{range === 'today' ? '時間帯別売上' : '日別売上'}</h2>
            {data.by_time.length === 0 ? (
              <p className="text-center text-brown-400 py-6">データなし</p>
            ) : (
              <div className="space-y-2">
                {data.by_time.map((entry) => {
                  const barWidth = Math.round((entry.revenue / maxRevenue) * 100)
                  const isPeak   = entry.period === peakPeriod
                  const w        = range !== 'today' ? weatherByPeriod.get(entry.period) : null
                  const ctx      = data.day_context[range === 'today' ? 'today' : entry.period]
                  return (
                    <div key={entry.period} className="flex items-center gap-2">
                      <span className="text-xs text-brown-500 w-12 shrink-0 text-right tabular-nums">{entry.period}</span>
                      {range !== 'today' && (
                        <span className="text-sm w-6 shrink-0 text-center" title={w?.weather_desc ?? ''}>{weatherEmoji(w?.weather_main ?? null)}</span>
                      )}
                      {/* イベント・競合マーカー */}
                      <span className="w-8 shrink-0 flex gap-0.5">
                        {ctx?.event_count > 0 && <span title={ctx.event_names.join(', ')} className="text-xs">🎪</span>}
                        {ctx?.reduced_competition && <span title="競合店休業" className="text-xs">🏪</span>}
                      </span>
                      <div className="flex-1 bg-cream-200 rounded-full h-6 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isPeak ? 'bg-amber-500' : 'bg-brown-500'}`}
                          style={{ width: `${Math.max(barWidth, 2)}%` }}
                        />
                      </div>
                      <span className="text-xs text-brown-600 w-20 shrink-0 tabular-nums text-right">¥{entry.revenue.toLocaleString()}</span>
                      <span className="text-xs text-brown-400 w-8 shrink-0 tabular-nums text-right">{entry.orders}件</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 売り切れ（今日のみ） */}
          {range === 'today' && <SoldoutSection logs={data.soldout_logs} />}

          {/* 商品別売上 */}
          <div className="card p-4">
            <h2 className="font-bold text-brown-700 mb-4">商品別売上</h2>
            {data.by_product.length === 0 ? (
              <p className="text-center text-brown-400 py-6">データなし</p>
            ) : (
              <div className="space-y-2">
                {data.by_product.map((product, i) => {
                  const maxProd  = data.by_product[0].revenue
                  const barWidth = Math.round((product.revenue / Math.max(maxProd, 1)) * 100)
                  const soldout  = range === 'today' ? data.soldout_logs.find((s) => s.product_id === product.id) : null
                  return (
                    <div key={product.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brown-400 w-5 shrink-0 text-center tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-sm font-bold text-brown-800 truncate">{product.name}</span>
                          <span className="text-xs text-brown-400 shrink-0">{product.quantity}個</span>
                          {soldout && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0">売切 {soldout.time}</span>}
                        </div>
                        <div className="bg-cream-200 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-brown-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(barWidth, 2)}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-brown-700 tabular-nums w-24 text-right shrink-0">¥{product.revenue.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 曜日別平均日商 */}
          {range !== 'today' && data.by_weekday.some((d) => d.count > 0) && (
            <WeekdaySection data={data.by_weekday} />
          )}

          {/* 天気別平均日商 */}
          {range !== 'today' && data.weather_correlation.length > 0 && (
            <WeatherCorrelation data={data.weather_correlation} />
          )}

          {/* 期間内イベント */}
          {data.events_in_range.length > 0 && (
            <EventsSection events={data.events_in_range} />
          )}

          {/* 天気履歴 */}
          {range !== 'today' && data.weather.length > 0 && (
            <WeatherHistory weather={data.weather} />
          )}

        </div>
      )}
      </>
      )}
    </div>
  )
}

// ─── カレンダービュー ────────────────────────────────────────

interface CalDayWeather { main: string; desc: string | null; temp_max: number | null; temp_min: number | null }
interface CalDayCompetitor { open_count: number; total: number; reduced_competition: boolean; shop_status: { id: string; name: string; is_open: boolean }[] }
interface CalendarDay {
  date: string; dow: number; dow_label: string; is_today: boolean; is_future: boolean
  actual_revenue: number | null; order_count: number | null
  weather_actual: CalDayWeather | null; weather_forecast: CalDayWeather | null
  competitor_status: CalDayCompetitor
  events: { name: string; scale: number }[]
  max_event_scale: number; predicted_revenue: number | null; vs_avg_pct: number | null
}
interface CalendarData {
  days: CalendarDay[]
  weekday_baselines: { dow: number; label: string; avg: number; count: number }[]
  month_summary: { total_actual: number; total_predicted: number; past_days_count: number; prediction_accuracy_pct: number | null }
}

function fmtK(n: number): string {
  if (n >= 100000) return `${Math.round(n / 10000)}万`
  if (n >= 10000)  return `${(n / 1000).toFixed(0)}k`
  return `${n}`
}

function DayCell({ day }: { day: CalendarDay }) {
  const weather = day.weather_actual ?? day.weather_forecast
  const revenue = day.is_future ? day.predicted_revenue : day.actual_revenue

  let bgClass = 'bg-white'
  if (!day.is_future) {
    if (day.actual_revenue === null) bgClass = 'bg-gray-50'
    else if (day.vs_avg_pct !== null) {
      if      (day.vs_avg_pct >  15) bgClass = 'bg-green-50'
      else if (day.vs_avg_pct < -15) bgClass = 'bg-red-50'
      else                           bgClass = 'bg-amber-50'
    }
  } else {
    bgClass = 'bg-cream-50'
  }

  const dateNum = parseInt(day.date.split('-')[2])
  const dateColor = day.dow === 0 ? 'text-red-500' : day.dow === 6 ? 'text-blue-500' : 'text-brown-700'

  return (
    <div className={`${bgClass} rounded-lg border ${day.is_today ? 'border-brown-500 border-2' : 'border-cream-200'} p-1 flex flex-col gap-0.5`} style={{ minHeight: '72px' }}>
      {/* 日付 + 天気 */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold leading-none ${dateColor}`}>{dateNum}</span>
        {weather && <span className="text-[11px] leading-none">{weatherEmoji(weather.main)}</span>}
      </div>

      {/* 売上 */}
      <div className="flex-1 flex items-center justify-center py-0.5">
        {revenue !== null ? (
          <div className="text-center">
            {day.is_future && <div className="text-[7px] text-brown-300 leading-none mb-0.5">予測</div>}
            <span className={`text-[11px] font-bold tabular-nums leading-none ${day.is_future ? 'text-brown-400' : 'text-brown-800'}`}>
              ¥{fmtK(revenue)}
            </span>
            {!day.is_future && day.vs_avg_pct !== null && (
              <div className={`text-[8px] leading-none mt-0.5 tabular-nums ${day.vs_avg_pct > 0 ? 'text-green-600' : 'text-red-400'}`}>
                {day.vs_avg_pct > 0 ? '+' : ''}{day.vs_avg_pct}%
              </div>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-brown-300">—</span>
        )}
      </div>

      {/* 競合ドット + イベント */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {day.competitor_status.shop_status.map((s) => (
            <span key={s.id} title={`${s.name}: ${s.is_open ? '営業' : '休業'}`}
              className={`w-1.5 h-1.5 rounded-full inline-block ${s.is_open ? 'bg-green-400' : 'bg-red-300'}`}
            />
          ))}
        </div>
        {day.max_event_scale > 0 && (
          <span className="text-amber-400 text-[9px] leading-none" title={day.events.map(e => e.name).join(', ')}>
            {'★'.repeat(Math.min(day.max_event_scale, 3))}
          </span>
        )}
      </div>
    </div>
  )
}

function CalendarView() {
  const nowDate  = new Date()
  const nowYear  = nowDate.getFullYear()
  const nowMonth = nowDate.getMonth() + 1

  const [year, setYear]       = useState(nowYear)
  const [month, setMonth]     = useState(nowMonth)
  const [data, setData]       = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true)
    const res = await fetch(`/api/admin/analytics/calendar?year=${y}&month=${m}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load(year, month) }, [year, month, load])

  const canNext = year < nowYear || (year === nowYear && month < nowMonth)
  const nav = (delta: number) => {
    let y = year, m = month + delta
    if (m < 1)  { y--; m = 12 }
    if (m > 12) { y++; m = 1  }
    setYear(y); setMonth(m)
  }

  const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']
  const firstDow = data ? new Date(data.days[0].date).getUTCDay() : 0

  const { month_summary: ms } = data ?? { month_summary: { total_actual: 0, total_predicted: 0, past_days_count: 0, prediction_accuracy_pct: null } }
  const monthEndForecast = ms.total_actual + (data ? data.days.filter(d => d.is_future && d.predicted_revenue).reduce((s, d) => s + (d.predicted_revenue ?? 0), 0) : 0)

  return (
    <div className="space-y-4">
      {/* 月ナビ */}
      <div className="flex items-center justify-between px-1">
        <button onClick={() => nav(-1)} className="w-9 h-9 flex items-center justify-center rounded-full bg-cream-200 hover:bg-cream-300 text-brown-600 font-bold">◀</button>
        <span className="font-bold text-brown-700 text-lg tabular-nums">{year}年{month}月</span>
        <button onClick={() => nav(1)} disabled={!canNext}
          className={`w-9 h-9 flex items-center justify-center rounded-full font-bold transition-colors ${canNext ? 'bg-cream-200 hover:bg-cream-300 text-brown-600' : 'bg-cream-100 text-brown-300 cursor-not-allowed'}`}
        >▶</button>
      </div>

      {/* 月サマリー */}
      {data && (
        <div className="card p-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-brown-400 mb-0.5">実績累計</p>
            <p className="text-sm font-bold text-brown-800 tabular-nums">¥{ms.total_actual.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-brown-400 mb-0.5">月末予測</p>
            <p className="text-sm font-bold text-brown-600 tabular-nums">¥{monthEndForecast.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-brown-400 mb-0.5">予測精度</p>
            <p className="text-sm font-bold text-brown-800 tabular-nums">
              {ms.prediction_accuracy_pct != null ? `${ms.prediction_accuracy_pct}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-brown-400">読み込み中...</div>
      ) : !data ? (
        <div className="text-center py-16 text-brown-400">データを取得できませんでした</div>
      ) : (
        <div className="card p-3">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW_LABELS.map((d, i) => (
              <div key={d} className={`text-center text-xs font-bold py-0.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-brown-500'}`}>{d}</div>
            ))}
          </div>

          {/* カレンダーグリッド */}
          <div className="grid grid-cols-7 gap-1">
            {/* 月初の空白 */}
            {Array(firstDow).fill(null).map((_, i) => <div key={`b${i}`} />)}
            {data.days.map((day) => <DayCell key={day.date} day={day} />)}
          </div>

          {/* 凡例 */}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-brown-500 border-t border-cream-200 pt-2">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block" />平均+15%超</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" />平均前後</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" />平均-15%以下</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cream-50 border border-cream-200 inline-block" />将来（予測）</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />競合営業</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-300 inline-block" />競合休業</span>
            <span className="flex items-center gap-1"><span className="text-amber-400">★</span>イベント</span>
          </div>
        </div>
      )}

      {/* 曜日別ベースライン */}
      {data && data.weekday_baselines.some(d => d.count > 0) && (
        <div className="card p-4">
          <h2 className="font-bold text-brown-700 mb-3 text-sm">予測ベースライン（曜日別平均）</h2>
          <div className="space-y-1.5">
            {data.weekday_baselines.map((b) => {
              const maxAvg = Math.max(...data.weekday_baselines.map(d => d.avg), 1)
              const barW = Math.round((b.avg / maxAvg) * 100)
              return (
                <div key={b.dow} className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-5 text-center shrink-0 ${b.dow === 0 ? 'text-red-400' : b.dow === 6 ? 'text-blue-400' : 'text-brown-600'}`}>{b.label}</span>
                  <div className="flex-1 bg-cream-200 rounded-full h-4 overflow-hidden">
                    {b.count > 0 && <div className="h-full bg-brown-400 rounded-full" style={{ width: `${Math.max(barW, 2)}%` }} />}
                  </div>
                  <span className="text-xs font-bold text-brown-700 w-20 tabular-nums text-right shrink-0">{b.count > 0 ? `¥${b.avg.toLocaleString()}` : '—'}</span>
                  <span className="text-xs text-brown-400 w-7 shrink-0 tabular-nums text-right">{b.count}日</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-brown-400 mt-2">予測 = 曜日平均 × 天気係数 × 競合休業係数 × イベント係数</p>
        </div>
      )}
    </div>
  )
}

// ─── サブコンポーネント ────────────────────────────────────────

function WeatherCard({ weather }: { weather: WeatherEntry | null }) {
  return (
    <div className="card p-4 border border-blue-100 bg-blue-50">
      <h2 className="font-bold text-blue-700 mb-2 text-sm">🌤️ 仙台の天気（今日）</h2>
      {weather ? (
        <div className="flex items-center gap-4">
          <span className="text-3xl">{weatherEmoji(weather.weather_main)}</span>
          <div>
            <p className="text-sm font-bold text-blue-800">{weather.weather_desc ?? weather.weather_main}</p>
            <p className="text-xs text-blue-600 tabular-nums">
              最高 {weather.temp_max != null ? `${Math.round(weather.temp_max)}°C` : '—'}{' / '}
              最低 {weather.temp_min != null ? `${Math.round(weather.temp_min)}°C` : '—'}
              {weather.precipitation > 0 && `　降水量 ${weather.precipitation}mm`}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-blue-400">天気データなし。OPENWEATHERMAP_API_KEY を設定するか、しばらく待ってください。</p>
      )}
    </div>
  )
}

function CompetitorStatusCard({ competitors }: { competitors: CompetitorEntry[] }) {
  const openCount = competitors.filter((c) => c.is_open).length
  return (
    <div className="card p-4 border border-orange-100 bg-orange-50">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-orange-700 text-sm">🏪 近隣おにぎり屋の状況</h2>
        <span className="text-xs text-orange-600 tabular-nums">{openCount}/{competitors.length}店営業中</span>
      </div>
      <div className="space-y-1.5">
        {competitors.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <span className={`text-sm ${c.is_open ? 'text-green-500' : 'text-red-400'}`}>{c.is_open ? '●' : '○'}</span>
            <span className="text-sm text-brown-800 flex-1">{c.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_open ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {c.is_open ? '営業中' : '休業'}
            </span>
            {c.is_override && <span className="text-xs text-amber-500">手動</span>}
          </div>
        ))}
      </div>
      <p className="text-xs text-orange-400 mt-2 text-right">
        <Link href="/admin/competitors" className="underline">スケジュール管理 →</Link>
      </p>
    </div>
  )
}

function SoldoutSection({ logs }: { logs: SoldoutEntry[] }) {
  return (
    <div className="card p-4">
      <h2 className="font-bold text-brown-700 mb-3">本日の売り切れ時刻</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-brown-400">まだ売り切れた商品はありません</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((entry) => (
            <div key={`${entry.product_id}-${entry.sold_out_at}`} className="flex items-center gap-3">
              <span className="text-red-500">🚫</span>
              <span className="text-sm text-brown-800 flex-1">{entry.product_name}</span>
              <span className="text-sm font-bold tabular-nums text-red-600">{entry.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WeekdaySection({ data }: { data: WeekdayEntry[] }) {
  const maxAvg = Math.max(...data.map((d) => d.avg_revenue), 1)
  return (
    <div className="card p-4">
      <h2 className="font-bold text-brown-700 mb-3">曜日別 平均日商</h2>
      <div className="space-y-2">
        {data.map((entry) => {
          const barWidth = Math.round((entry.avg_revenue / maxAvg) * 100)
          return (
            <div key={entry.dow} className="flex items-center gap-2">
              <span className={`text-xs font-bold w-5 shrink-0 text-center ${entry.dow === 0 ? 'text-red-400' : entry.dow === 6 ? 'text-blue-400' : 'text-brown-600'}`}>{entry.label}</span>
              <div className="flex-1 bg-cream-200 rounded-full h-5 overflow-hidden">
                {entry.count > 0 && <div className="h-full bg-matcha-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(barWidth, 2)}%` }} />}
              </div>
              <span className="text-xs font-bold text-brown-700 w-20 tabular-nums text-right shrink-0">{entry.count > 0 ? `¥${entry.avg_revenue.toLocaleString()}` : '—'}</span>
              <span className="text-xs text-brown-400 w-7 shrink-0 tabular-nums text-right">{entry.count}日</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeatherCorrelation({ data }: { data: WeatherCorrEntry[] }) {
  const maxRev = Math.max(...data.map((d) => d.avg_revenue), 1)
  return (
    <div className="card p-4">
      <h2 className="font-bold text-brown-700 mb-3">天気別 平均日商</h2>
      <div className="space-y-2">
        {data.map((entry) => {
          const barWidth = Math.round((entry.avg_revenue / maxRev) * 100)
          return (
            <div key={entry.weather_main} className="flex items-center gap-2">
              <span className="text-base w-6 shrink-0 text-center">{weatherEmoji(entry.weather_main)}</span>
              <span className="text-xs text-brown-600 w-14 shrink-0 truncate">{entry.label}</span>
              <div className="flex-1 bg-cream-200 rounded-full h-5 overflow-hidden">
                <div className="h-full bg-sky-400 rounded-full transition-all duration-500" style={{ width: `${Math.max(barWidth, 2)}%` }} />
              </div>
              <span className="text-xs font-bold text-brown-700 w-20 tabular-nums text-right shrink-0">¥{entry.avg_revenue.toLocaleString()}</span>
              <span className="text-xs text-brown-400 w-7 shrink-0 tabular-nums text-right">{entry.days}日</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventsSection({ events }: { events: EventEntry[] }) {
  return (
    <div className="card p-4">
      <h2 className="font-bold text-brown-700 mb-3">期間内のイベント</h2>
      <div className="space-y-2.5">
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-2">
            <span className="text-base shrink-0 mt-0.5">🎪</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-brown-800">{e.name}</p>
              <p className="text-xs text-brown-500">
                {e.date}{e.end_date && e.end_date !== e.date ? ` 〜 ${e.end_date}` : ''}
                {e.location && <span className="ml-1">📍{e.location}</span>}
              </p>
            </div>
            <span className="text-amber-400 text-xs shrink-0">{'★'.repeat(e.scale)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WeatherHistory({ weather }: { weather: WeatherEntry[] }) {
  return (
    <div className="card p-4">
      <h2 className="font-bold text-brown-700 mb-3">天気履歴</h2>
      <div className="space-y-1.5">
        {weather.map((w) => {
          const [, m, d] = w.date.split('-')
          return (
            <div key={w.date} className="flex items-center gap-3 text-sm">
              <span className="text-brown-500 w-10 tabular-nums shrink-0">{`${parseInt(m)}/${parseInt(d)}`}</span>
              <span className="text-base w-6 shrink-0">{weatherEmoji(w.weather_main)}</span>
              <span className="text-brown-600 flex-1 truncate">{w.weather_desc ?? w.weather_main ?? '—'}</span>
              <span className="text-brown-500 tabular-nums shrink-0 text-xs">
                {w.temp_max != null ? `${Math.round(w.temp_max)}°` : '—'}/{w.temp_min != null ? `${Math.round(w.temp_min)}°` : '—'}
              </span>
              {w.precipitation > 0 && <span className="text-blue-500 text-xs tabular-nums shrink-0">{w.precipitation}mm</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, change, changeLabel }: { label: string; value: string; color: string; change?: number | null; changeLabel?: string }) {
  return (
    <div className={`card p-3 border ${color}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
      {change != null && changeLabel && (
        <p className={`text-xs mt-0.5 tabular-nums ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-brown-400'}`}>
          {change > 0 ? '↑' : change < 0 ? '↓' : '→'}{Math.abs(change)}% {changeLabel}
        </p>
      )}
    </div>
  )
}
