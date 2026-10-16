'use client'

import { useCallback, useEffect, useState } from 'react'
import OrderCard from '@/components/admin/OrderCard'
import type { Order } from '@/lib/types'
import { TAKEOUT_TABLE_ID, calcOrderTotal, formatScheduleDate } from '@/lib/types'

/** 日本時間の今日（YYYY-MM-DD） */
const jstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())

/** YYYY-MM-DD を days 日ずらす */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

type Filter = 'all' | 'paid' | 'unpaid'

/**
 * 注文履歴（その日の注文をすべて表示。会計済みも含む）
 * 間違えて会計済みにした注文も、ここから開いて確認・取り消しができる
 */
export default function OrderHistoryPage() {
  const [date, setDate] = useState(jstToday)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/history?date=${date}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setOrders(await res.json())
    } catch {
      setError('履歴を読み込めませんでした。通信状況を確認して、もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const paidOrders = orders.filter((o) => o.status === 'paid')
  const shown = orders
    .filter((o) => (filter === 'paid' ? o.status === 'paid' : filter === 'unpaid' ? o.status !== 'paid' : true))
    // 新しい注文を上に
    .slice()
    .reverse()
  const paidTotal = paidOrders.reduce((sum, o) => sum + calcOrderTotal(o.order_items ?? []), 0)
  const isToday = date === jstToday()

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="section-title mb-1">注文履歴</h1>
      <p className="text-sm text-brown-500 mb-4">
        会計済みの注文も含めて、その日の注文をすべて表示します。開くと内容の確認や、会計済みの取り消しができます。
      </p>

      {/* 日付 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setDate((d) => shiftDate(d, -1))}
          className="px-3 py-2 rounded-xl border border-cream-300 bg-white text-brown-700 font-bold"
          aria-label="前の日"
        >
          ←
        </button>
        <input
          type="date"
          value={date}
          max={jstToday()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-base text-brown-800"
        />
        <button
          type="button"
          onClick={() => setDate((d) => shiftDate(d, 1))}
          disabled={isToday}
          className="px-3 py-2 rounded-xl border border-cream-300 bg-white text-brown-700 font-bold disabled:opacity-30"
          aria-label="次の日"
        >
          →
        </button>
        {!isToday && (
          <button type="button" onClick={() => setDate(jstToday())} className="text-sm text-brown-500 underline">
            今日
          </button>
        )}
      </div>

      {/* まとめ */}
      <div className="card p-4 mb-4 flex flex-wrap gap-x-6 gap-y-1 text-brown-700">
        <p className="font-bold">{formatScheduleDate(date)}</p>
        <p>
          注文 <span className="font-bold tabular-nums">{orders.length}</span> 件
          <span className="text-brown-400 text-sm ml-1">
            （店内 {orders.filter((o) => o.table_id !== TAKEOUT_TABLE_ID).length}・テイクアウト{' '}
            {orders.filter((o) => o.table_id === TAKEOUT_TABLE_ID).length}）
          </span>
        </p>
        <p>
          会計済み <span className="font-bold tabular-nums">{paidOrders.length}</span> 件・
          <span className="font-bold tabular-nums">¥{paidTotal.toLocaleString()}</span>
        </p>
      </div>

      {/* 絞り込み */}
      <div className="flex gap-2 mb-4">
        {(
          [
            ['all', 'すべて'],
            ['paid', '会計済み'],
            ['unpaid', '未会計'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${
              filter === key ? 'bg-brown-600 border-brown-600 text-white' : 'bg-white border-cream-300 text-brown-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-center text-brown-400 py-10">読み込み中...</p>
      ) : shown.length === 0 ? (
        <p className="text-center text-brown-400 py-10">この日の注文はありません</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((order) => (
            <OrderCard key={order.id} order={order} onStatusChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}
