'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import { TAKEOUT_TABLE_ID } from '@/lib/types'
import OrderCard from '@/components/admin/OrderCard'
import RiceTimer from '@/components/admin/RiceTimer'
import OrderBoard from '@/components/admin/OrderBoard'

type Tab = 'all' | 'eatin' | 'takeout'

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
  const [tab, setTab] = useState<Tab>('all')
  // 通知音は最初からON（ブラウザの決まりで、画面を一度タッチするまでは鳴らせない）
  const [soundEnabled, setSoundEnabled] = useState(true)
  /** 残りわずか・売り切れのお知らせ */
  const [stockAlerts, setStockAlerts] = useState<{
    low: { name: string; remaining: number }[]
    soldOut: string[]
  }>({ low: [], soldOut: [] })

  /** AudioContext は最初のユーザー操作後に生成（autoplay policy対策） */
  const audioCtxRef = useRef<AudioContext | null>(null)
  /** soundEnabled の最新値をコールバック内で参照するための ref */
  const soundEnabledRef = useRef(true)
  /** 音を鳴らす準備ができたか（画面を一度触ったか） */
  const [audioReady, setAudioReady] = useState(false)
  /** 初回ロード済みフラグ（初回取得時は音を鳴らさない） */
  const isInitialLoad = useRef(true)
  /** 既知の注文IDセット */
  const knownOrderIds = useRef<Set<string>>(new Set())

  const fetchOrders = useCallback(async () => {
    // 注文が入るたびに残り数も変わるので、一緒に取り直す（失敗しても注文一覧は出す）
    fetch('/api/admin/stock/alerts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setStockAlerts(data))
      .catch(() => {})

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

    // Supabase Realtime：注文変更を即時反映
    const supabase = createClient()
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()

    // Realtime が無効な環境向けに15秒ポーリングをフォールバックとして追加
    const timer = setInterval(fetchOrders, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchOrders])

  /**
   * 音を鳴らす準備（AudioContext の作成・再開）
   * ブラウザは、画面を触る前に音を鳴らすことを許さないため、最初のタッチ・クリックで準備する
   */
  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    setAudioReady(true)
  }, [])

  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    const handler = () => {
      unlockAudio()
      events.forEach((e) => window.removeEventListener(e, handler))
    }
    events.forEach((e) => window.addEventListener(e, handler))
    return () => events.forEach((e) => window.removeEventListener(e, handler))
  }, [unlockAudio])

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    soundEnabledRef.current = next
    if (!soundEnabled) {
      unlockAudio()
      if (audioCtxRef.current) playChime(audioCtxRef.current)
    }
  }

  const filteredOrders = (() => {
    const base = orders.filter((o) => {
      if (tab === 'takeout') return o.table_id === TAKEOUT_TABLE_ID
      if (tab === 'eatin') return o.table_id !== TAKEOUT_TABLE_ID
      return true
    })
    if (tab === 'takeout' || tab === 'all') {
      // イートインを先に、その下にテイクアウトを並べる。
      // それぞれの中は時間の近い順（テイクアウトは受取時間、イートインは注文時間）
      const sortKey = (o: Order) => o.pickup_at ?? o.created_at ?? ''
      return [...base].sort((a, b) => {
        const aTakeout = a.table_id === TAKEOUT_TABLE_ID ? 1 : 0
        const bTakeout = b.table_id === TAKEOUT_TABLE_ID ? 1 : 0
        if (aTakeout !== bTakeout) return aTakeout - bTakeout
        return sortKey(a).localeCompare(sortKey(b))
      })
    }
    return base
  })()

  // すべて/テイクアウトタブ: 本日分と明日以降に分ける（時間順は filteredOrders で維持）
  const jstDate = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(iso))
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())
  const todayOrders = filteredOrders.filter(
    (o) => !o.pickup_at || jstDate(o.pickup_at) <= todayStr,
  )
  const laterOrders = filteredOrders.filter(
    (o) => o.pickup_at && jstDate(o.pickup_at) > todayStr,
  )

  // イートイン（席からの注文。未調理・調理済みの合計）と、そのうち提供済み
  const eatinOrders = orders.filter((o) => o.table_id !== TAKEOUT_TABLE_ID)
  const eatinCount = eatinOrders.length
  const servedCount = eatinOrders.filter((o) => o.status === 'served').length
  const takeoutCount = orders.filter((o) => o.table_id === TAKEOUT_TABLE_ID).length

  return (
    <div className="p-4 md:p-6">
      {soundEnabled && !audioReady && (
        <p className="mb-3 text-sm text-brown-500 bg-cream-100 border border-cream-300 rounded-xl px-3 py-2">
          🔔 画面をどこか一度タッチすると、新しい注文の通知音が鳴るようになります
        </p>
      )}

      {/* 残りわずか・売り切れのお知らせ */}
      {(stockAlerts.low.length > 0 || stockAlerts.soldOut.length > 0) && (
        <div className="mb-4 space-y-2">
          {stockAlerts.low.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-bold mr-2">残りわずか</span>
              {stockAlerts.low.map((l) => `${l.name}（残り${l.remaining}）`).join('、')}
            </div>
          )}
          {stockAlerts.soldOut.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-bold mr-2">売り切れ</span>
              {stockAlerts.soldOut.join('、')}
            </div>
          )}
        </div>
      )}

      <RiceTimer />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="イートイン" count={eatinCount} color="text-amber-700 bg-amber-50 border-amber-200" />
        <SummaryCard label="提供済み" count={servedCount} color="text-blue-700 bg-blue-50 border-blue-200" />
        <SummaryCard label="テイクアウト" count={takeoutCount} color="text-green-700 bg-green-50 border-green-200" />
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
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 text-brown-400">
          <p className="text-xl">現在、未会計の注文はありません</p>
        </div>
      ) : tab === 'takeout' || tab === 'all' ? (
        <div className="space-y-6">
          {todayOrders.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 mb-3 w-fit">
                本日分（{todayOrders.length}件）
              </h2>
              <OrderBoard orders={todayOrders} onChanged={fetchOrders} />
            </section>
          )}
          {laterOrders.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-brown-600 bg-cream-200 border border-cream-300 rounded-lg px-3 py-1.5 mb-3 w-fit">
                明日以降（{laterOrders.length}件）
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {laterOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <OrderBoard orders={filteredOrders} onChanged={fetchOrders} />
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
