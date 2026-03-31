'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import OrderCard from '@/components/admin/OrderCard'

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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

    // Supabase Realtime で注文の追加・更新をリアルタイム反映
    const supabase = createClient()
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_items' },
        () => fetchOrders(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchOrders])

  const newCount = orders.filter((o) => o.status === 'new').length
  const preparingCount = orders.filter((o) => o.status === 'preparing').length

  return (
    <div className="p-4 md:p-6">
      {/* サマリ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="新規" count={newCount} color="text-amber-700 bg-amber-50 border-amber-200" />
        <SummaryCard label="調理中" count={preparingCount} color="text-blue-700 bg-blue-50 border-blue-200" />
        <SummaryCard label="未会計 合計" count={orders.length} color="text-brown-700 bg-cream-100 border-cream-300" />
        <div className="card p-3 flex items-center justify-center">
          <button
            onClick={fetchOrders}
            className="text-brown-500 text-sm flex items-center gap-2"
          >
            <span className="text-xl">🔄</span>
            更新
          </button>
        </div>
      </div>

      <h1 className="section-title mb-4">未会計の注文</h1>

      {loading ? (
        <div className="text-center py-16">
          <div className="text-5xl animate-bounce">🍙</div>
          <p className="text-brown-400 mt-2">読み込み中...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-5xl mb-3">🍵</p>
          <p className="text-xl">現在、未会計の注文はありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className={`card p-3 border ${color}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{count}</p>
    </div>
  )
}
