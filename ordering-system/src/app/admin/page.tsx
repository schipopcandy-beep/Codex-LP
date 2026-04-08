'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import { TAKEOUT_TABLE_ID } from '@/lib/types'
import OrderCard from '@/components/admin/OrderCard'

type Tab = 'all' | 'eatin' | 'takeout'

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/admin/orders')
    if (res.ok) {
      const data = await res.json()
      setOrders(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()

    const supabase = createClient()
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders])

  const filteredOrders = orders.filter((o) => {
    if (tab === 'takeout') return o.table_id === TAKEOUT_TABLE_ID
    if (tab === 'eatin') return o.table_id !== TAKEOUT_TABLE_ID
    return true
  })

  const newCount = filteredOrders.filter((o) => o.status === 'new').length
  const preparingCount = filteredOrders.filter((o) => o.status === 'preparing').length
  const takeoutCount = orders.filter((o) => o.table_id === TAKEOUT_TABLE_ID).length

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="新規" count={newCount} color="text-amber-700 bg-amber-50 border-amber-200" />
        <SummaryCard label="調理中" count={preparingCount} color="text-blue-700 bg-blue-50 border-blue-200" />
        <SummaryCard label="テイクアウト" count={takeoutCount} color="text-green-700 bg-green-50 border-green-200" />
        <div className="card p-3 flex items-center justify-center">
          <button
            onClick={fetchOrders}
            className="text-brown-500 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            更新
          </button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-4 bg-cream-200 rounded-xl p-1 w-fit">
        {([['all', 'すべて'], ['eatin', 'イートイン'], ['takeout', 'テイクアウト']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-white text-brown-800 shadow-sm'
                : 'text-brown-500 hover:text-brown-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <h1 className="section-title mb-4">未会計の注文</h1>

      {loading ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-lg">読み込み中...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-xl">現在、未会計の注文はありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`card p-3 border ${color}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{count}</p>
    </div>
  )
}
