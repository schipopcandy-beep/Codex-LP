'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Range = 'today' | 'week' | 'month'

interface Summary {
  total_revenue: number
  order_count: number
  total_party_size: number
  avg_per_order: number
  avg_per_person: number | null
}

interface PrevSummary {
  total_revenue: number
  order_count: number
  avg_per_order: number
}

interface TimeEntry {
  period: string
  revenue: number
  orders: number
}

interface ProductEntry {
  id: string
  name: string
  category: string
  quantity: number
  revenue: number
}

interface SoldoutEntry {
  product_id: string
  product_name: string
  sold_out_at: string
  date: string
  time: string
}

interface WeatherEntry {
  date: string
  temp_max: number | null
  temp_min: number | null
  temp_avg: number | null
  weather_main: string | null
  weather_desc: string | null
  icon: string | null
  precipitation: number
}

interface WeatherCorrEntry {
  weather_main: string
  label: string
  avg_revenue: number
  days: number
}

interface AnalyticsData {
  summary: Summary
  prev_summary: PrevSummary
  by_time: TimeEntry[]
  by_product: ProductEntry[]
  soldout_logs: SoldoutEntry[]
  weather: WeatherEntry[]
  weather_correlation: WeatherCorrEntry[]
}

const RANGE_LABELS: Record<Range, string> = {
  today: '今日',
  week: '直近7日',
  month: '今月',
}

const CHANGE_LABELS: Record<Range, string> = {
  today: '前日比',
  week: '前週比',
  month: '前月比',
}

const WEATHER_EMOJI: Record<string, string> = {
  Clear: '☀️',
  Clouds: '☁️',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Snow: '❄️',
  Thunderstorm: '⛈️',
  Mist: '🌫️',
  Fog: '🌫️',
  Haze: '🌫️',
}

function weatherEmoji(main: string | null): string {
  return main ? (WEATHER_EMOJI[main] ?? '🌤️') : '—'
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('today')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true)
    const res = await fetch(`/api/admin/analytics?range=${r}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(range) }, [range, fetchData])

  const maxRevenue = data ? Math.max(...data.by_time.map((t) => t.revenue), 1) : 1
  const peakPeriod = data?.by_time.reduce((peak, e) => e.revenue > peak.revenue ? e : peak, data.by_time[0])?.period ?? null

  const weatherByPeriod = new Map<string, WeatherEntry>()
  if (data) {
    for (const w of data.weather) {
      const [, m, d] = w.date.split('-')
      weatherByPeriod.set(`${parseInt(m)}/${parseInt(d)}`, w)
    }
  }

  const todayWeather = data?.weather.at(-1) ?? null
  const changeLabel = CHANGE_LABELS[range]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-brown-500 hover:text-brown-700 text-base">
          ← 一覧
        </Link>
        <h1 className="section-title text-2xl">売上分析</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {(['today', 'week', 'month'] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl font-bold text-sm border transition-colors ${
              range === r
                ? 'bg-brown-600 text-white border-brown-600'
                : 'bg-cream-100 text-brown-700 border-cream-300 hover:bg-cream-200'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-brown-400 text-lg">読み込み中...</div>
      ) : !data ? (
        <div className="text-center py-20 text-brown-400">データを取得できませんでした</div>
      ) : (
        <div className="space-y-5">

          {range === 'today' && (
            <WeatherCard weather={todayWeather} />
          )}

          {/* サマリーカード（前期比付き） */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              label="総売上"
              value={`¥${data.summary.total_revenue.toLocaleString()}`}
              color="text-brown-700 bg-cream-100 border-cream-300"
              change={pctChange(data.summary.total_revenue, data.prev_summary.total_revenue)}
              changeLabel={changeLabel}
            />
            <SummaryCard
              label="注文数 / 来客数"
              value={`${data.summary.order_count}件 / ${data.summary.total_party_size}名`}
              color="text-blue-700 bg-blue-50 border-blue-200"
              change={pctChange(data.summary.order_count, data.prev_summary.order_count)}
              changeLabel={changeLabel}
            />
            <SummaryCard
              label="客単価（1注文あたり）"
              value={`¥${data.summary.avg_per_order.toLocaleString()}`}
              color="text-amber-700 bg-amber-50 border-amber-200"
              change={pctChange(data.summary.avg_per_order, data.prev_summary.avg_per_order)}
              changeLabel={changeLabel}
            />
            <SummaryCard
              label="客単価（1人あたり）"
              value={data.summary.avg_per_person != null ? `¥${data.summary.avg_per_person.toLocaleString()}` : '—'}
              color="text-matcha-700 bg-matcha-50 border-matcha-200"
            />
          </div>

          {/* 時間別・日別グラフ */}
          <div className="card p-4">
            <h2 className="font-bold text-brown-700 mb-4">
              {range === 'today' ? '時間帯別売上' : '日別売上'}
            </h2>

            {data.by_time.length === 0 ? (
              <p className="text-center text-brown-400 py-6">データなし</p>
            ) : (
              <div className="space-y-2">
                {data.by_time.map((entry) => {
                  const barWidth = Math.round((entry.revenue / maxRevenue) * 100)
                  const isPeak = entry.period === peakPeriod
                  const w = range !== 'today' ? weatherByPeriod.get(entry.period) : null
                  return (
                    <div key={entry.period} className="flex items-center gap-2">
                      <span className="text-xs text-brown-500 w-12 shrink-0 text-right tabular-nums">
                        {entry.period}
                      </span>
                      {range !== 'today' && (
                        <span className="text-sm w-6 shrink-0 text-center" title={w?.weather_desc ?? ''}>
                          {weatherEmoji(w?.weather_main ?? null)}
                        </span>
                      )}
                      <div className="flex-1 bg-cream-200 rounded-full h-6 overflow-hidden">
                        <div
                          className={`h-full rounded-full flex items-center px-2 transition-all duration-500 ${
                            isPeak ? 'bg-amber-500' : 'bg-brown-500'
                          }`}
                          style={{ width: `${Math.max(barWidth, 2)}%` }}
                        />
                      </div>
                      <span className="text-xs text-brown-600 w-20 shrink-0 tabular-nums text-right">
                        ¥{entry.revenue.toLocaleString()}
                      </span>
                      <span className="text-xs text-brown-400 w-8 shrink-0 tabular-nums text-right">
                        {entry.orders}件
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {range === 'today' && (
            <SoldoutSection logs={data.soldout_logs} />
          )}

          {/* 商品別売上ランキング */}
          <div className="card p-4">
            <h2 className="font-bold text-brown-700 mb-4">商品別売上</h2>

            {data.by_product.length === 0 ? (
              <p className="text-center text-brown-400 py-6">データなし</p>
            ) : (
              <div className="space-y-2">
                {data.by_product.map((product, i) => {
                  const maxProdRevenue = data.by_product[0].revenue
                  const barWidth = Math.round((product.revenue / Math.max(maxProdRevenue, 1)) * 100)
                  const soldout = range === 'today'
                    ? data.soldout_logs.find((s) => s.product_id === product.id)
                    : null
                  return (
                    <div key={product.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brown-400 w-5 shrink-0 text-center tabular-nums">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-sm font-bold text-brown-800 truncate">{product.name}</span>
                          <span className="text-xs text-brown-400 shrink-0">{product.quantity}個</span>
                          {soldout && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0">
                              売切 {soldout.time}
                            </span>
                          )}
                        </div>
                        <div className="bg-cream-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-brown-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(barWidth, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-brown-700 tabular-nums w-24 text-right shrink-0">
                        ¥{product.revenue.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 天気×売上相関（week/month） */}
          {range !== 'today' && data.weather_correlation.length > 0 && (
            <WeatherCorrelation data={data.weather_correlation} />
          )}

          {/* 天気履歴（week/month） */}
          {range !== 'today' && data.weather.length > 0 && (
            <WeatherHistory weather={data.weather} />
          )}

        </div>
      )}
    </div>
  )
}

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
              最高 {weather.temp_max != null ? `${Math.round(weather.temp_max)}°C` : '—'}
              {' / '}
              最低 {weather.temp_min != null ? `${Math.round(weather.temp_min)}°C` : '—'}
              {weather.precipitation > 0 && `　降水量 ${weather.precipitation}mm`}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-blue-400">
          天気データなし。OPENWEATHERMAP_API_KEY を設定するか、しばらく待ってください。
        </p>
      )}
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
                <div
                  className="h-full bg-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(barWidth, 2)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-brown-700 w-20 tabular-nums text-right shrink-0">
                ¥{entry.avg_revenue.toLocaleString()}
              </span>
              <span className="text-xs text-brown-400 w-7 shrink-0 tabular-nums text-right">
                {entry.days}日
              </span>
            </div>
          )
        })}
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
                {w.temp_max != null ? `${Math.round(w.temp_max)}°` : '—'}
                /
                {w.temp_min != null ? `${Math.round(w.temp_min)}°` : '—'}
              </span>
              {w.precipitation > 0 && (
                <span className="text-blue-500 text-xs tabular-nums shrink-0">{w.precipitation}mm</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCard({
  label, value, color, change, changeLabel,
}: {
  label: string
  value: string
  color: string
  change?: number | null
  changeLabel?: string
}) {
  return (
    <div className={`card p-3 border ${color}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
      {change != null && changeLabel && (
        <p className={`text-xs mt-0.5 tabular-nums ${
          change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-brown-400'
        }`}>
          {change > 0 ? '↑' : change < 0 ? '↓' : '→'}{Math.abs(change)}% {changeLabel}
        </p>
      )}
    </div>
  )
}
