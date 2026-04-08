'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Range = 'today' | 'week' | 'month'

interface Summary {
  total_revenue: number
  order_count: number
  avg_order_value: number
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

interface AnalyticsData {
  summary: Summary
  by_time: TimeEntry[]
  by_product: ProductEntry[]
}

const RANGE_LABELS: Record<Range, string> = {
  today: '今日',
  week: '直近7日',
  month: '今月',
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('today')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true)
    const res = await fetch(`/api/admin/analytics?range=${r}`)
    if (res.ok) {
      const json = await res.json()
      setData(json)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData(range)
  }, [range, fetchData])

  const maxRevenue = data ? Math.max(...data.by_time.map((t) => t.revenue), 1) : 1

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-brown-500 hover:text-brown-700 text-base">
          ← 一覧
        </Link>
        <h1 className="section-title text-2xl">売上分析</h1>
      </div>

      {/* 期間切替 */}
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

          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="総売上"
              value={`¥${data.summary.total_revenue.toLocaleString()}`}
              color="text-brown-700 bg-cream-100 border-cream-300"
            />
            <SummaryCard
              label="注文数"
              value={`${data.summary.order_count}件`}
              color="text-blue-700 bg-blue-50 border-blue-200"
            />
            <SummaryCard
              label="客単価"
              value={`¥${data.summary.avg_order_value.toLocaleString()}`}
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
                  return (
                    <div key={entry.period} className="flex items-center gap-2">
                      <span className="text-xs text-brown-500 w-12 shrink-0 text-right tabular-nums">
                        {entry.period}
                      </span>
                      <div className="flex-1 bg-cream-200 rounded-full h-6 overflow-hidden">
                        <div
                          className="h-full bg-brown-500 rounded-full flex items-center px-2 transition-all duration-500"
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
                  return (
                    <div key={product.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brown-400 w-5 shrink-0 text-center tabular-nums">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-sm font-bold text-brown-800 truncate">{product.name}</span>
                          <span className="text-xs text-brown-400 shrink-0">{product.quantity}個</span>
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

        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`card p-3 border ${color}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
    </div>
  )
}
