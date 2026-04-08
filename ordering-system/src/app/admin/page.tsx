'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import OrderCard from '@/components/admin/OrderCard'

/** Web Audio API でチャイム音を鳴らす */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime
  // 2音のチャイム: A5(880Hz) → C#6(1109Hz)
  const notes = [880, 1109]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = now + i * 0.18
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.35, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.start(t)
    osc.stop(t + 0.6)
  })
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)

  /** AudioContext は最初のユーザー操作後に生成（autoplay policy対策） */
  const audioCtxRef = useRef<AudioContext | null>(null)
  /** soundEnabled の最新値をコールバック内で参照するための ref */
  const soundEnabledRef = useRef(false)
  /** 初回ロード済みフラグ（初回取得時は音を鳴らさない） */
  const isInitialLoad = useRef(true)
  /** 既知の注文IDセット */
  const knownOrderIds = useRef<Set<string>>(new Set())

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/admin/orders')
    if (!res.ok) { setLoading(false); return }

    const data: Order[] = await res.json()
    setOrders(data)
    setLoading(false)

    if (isInitialLoad.current) {
      // 初回: 既存IDを記録するだけ（音は鳴らさない）
      data.forEach((o) => knownOrderIds.current.add(o.id))
      isInitialLoad.current = false
      return
    }

    // 新規注文（status === 'new'）が追加されたか確認
    const hasNewOrder = data.some(
      (o) => o.status === 'new' && !knownOrderIds.current.has(o.id),
    )
    data.forEach((o) => knownOrderIds.current.add(o.id))

    if (hasNewOrder && soundEnabledRef.current && audioCtxRef.current) {
      playChime(audioCtxRef.current)
    }
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

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    soundEnabledRef.current = next
    if (!soundEnabled) {
      // 初めてONにするとき AudioContext を生成（ユーザー操作が必要）
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      // AudioContext が suspended の場合は resume
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
      // 確認音を1回鳴らす
      playChime(audioCtxRef.current)
    }
  }

  const newCount = orders.filter((o) => o.status === 'new').length
  const preparingCount = orders.filter((o) => o.status === 'preparing').length

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="新規" count={newCount} color="text-amber-700 bg-amber-50 border-amber-200" />
        <SummaryCard label="調理中" count={preparingCount} color="text-blue-700 bg-blue-50 border-blue-200" />
        <SummaryCard label="未会計 合計" count={orders.length} color="text-brown-700 bg-cream-100 border-cream-300" />
        <div className="card p-3 flex items-center justify-center gap-2">
          <button
            onClick={fetchOrders}
            className="text-brown-500 text-sm font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            更新
          </button>
          <span className="text-brown-300">|</span>
          <button
            onClick={toggleSound}
            className={`text-sm font-medium flex items-center gap-1 ${soundEnabled ? 'text-matcha-600' : 'text-brown-400'}`}
            title={soundEnabled ? '通知音ON（クリックでOFF）' : '通知音OFF（クリックでON）'}
          >
            {soundEnabled ? '🔔' : '🔕'}
            <span className="hidden md:inline">{soundEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="section-title">未会計の注文</h1>
        <Link href="/admin/analytics" className="text-sm text-brown-500 hover:text-brown-700 underline">
          売上分析 →
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-lg">読み込み中...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-brown-400">
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

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`card p-3 border ${color}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{count}</p>
    </div>
  )
}
