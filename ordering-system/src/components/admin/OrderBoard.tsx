'use client'

import { useEffect, useRef, useState } from 'react'
import OrderCard from '@/components/admin/OrderCard'
import LineContactButton from '@/components/admin/LineContactButton'
import { useConfirm } from '@/components/admin/useConfirm'
import type { Order, OrderStatus } from '@/lib/types'
import { TABLE_NAMES, TAKEOUT_TABLE_ID, calcOrderTotal, orderShortId } from '@/lib/types'

/** 調理済みの列に入れるステータス */
const isCooked = (o: Order) => o.status === 'served'

/** 伝票に最後に明細が入った時刻（追加注文の時刻） */
const lastItemTime = (o: Order) =>
  (o.order_items ?? []).reduce((max, i) => (i.created_at > max ? i.created_at : max), o.created_at)

/** ドラッグとみなすまでの横の移動量（px） */
const DRAG_THRESHOLD = 12

interface Props {
  orders: Order[]
  /** ステータスを変えた後に一覧を取り直す */
  onChanged: () => void
}

/**
 * 注文一覧のボード表示
 * 左（2列）: 未調理（新規・追加・調理中） / 右（1列）: 調理済み
 * カードを右の列へドラッグすると調理済みに、左へ戻すと調理中に戻る。
 * ドラッグしにくい端末向けに、カードの下のボタンでも移せる。
 */
export default function OrderBoard({ orders, onChanged }: Props) {
  /** 保存が終わるまで、移したカードを移した先に表示しておく */
  const [pending, setPending] = useState<Map<string, OrderStatus>>(new Map())
  const [error, setError] = useState<string | null>(null)
  /** ドラッグ中に、どちらの列の上にいるか */
  const [hover, setHover] = useState<'left' | 'right' | null>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [confirm, confirmDialog] = useConfirm()

  // 一覧を取り直したら、保存済みの仮表示を消す
  useEffect(() => {
    setPending((prev) => {
      if (prev.size === 0) return prev
      const next = new Map(prev)
      for (const o of orders) if (next.get(o.id) === o.status) next.delete(o.id)
      return next
    })
  }, [orders])

  // 会計済みにしたカードは、一覧を取り直すのを待たずに消す
  const shown = orders
    .map((o) => (pending.has(o.id) ? { ...o, status: pending.get(o.id)! } : o))
    .filter((o) => o.status !== 'paid')
  // 追加注文が入った伝票は、未調理の一番下へ（追加が入った順に並べる）
  const uncooked = [
    ...shown.filter((o) => !isCooked(o) && o.status !== 'added'),
    ...shown
      .filter((o) => o.status === 'added')
      .sort((a, b) => lastItemTime(a).localeCompare(lastItemTime(b))),
  ]
  const cooked = shown.filter(isCooked)

  const moveTo = async (order: Order, status: OrderStatus) => {
    if (order.status === status) return
    setError(null)
    setPending((prev) => new Map(prev).set(order.id, status))
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setPending((prev) => {
        const next = new Map(prev)
        next.delete(order.id)
        return next
      })
      setError(
        status === 'paid'
          ? '会計済みにできませんでした。通信状況を確認して、もう一度お試しください。'
          : '移動できませんでした。通信状況を確認して、もう一度お試しください。',
      )
    }
    onChanged()
  }

  /** 調理済みのカードから、そのまま会計済みにする（間違えて押さないよう確認する） */
  const markPaid = async (order: Order) => {
    const name =
      order.table_id === TAKEOUT_TABLE_ID
        ? `テイクアウト No.${orderShortId(order.id)}`
        : TABLE_NAMES[order.table_id] ?? order.table_id
    const total = calcOrderTotal(order.order_items ?? [])
    if (!(await confirm(`${name}（¥${total.toLocaleString()}）を会計済みにしますか？`, { confirmLabel: '会計済みにする' }))) {
      return
    }
    await moveTo(order, 'paid')
  }

  /** ドロップした位置から、どちらの列かを判定する */
  const columnAt = (x: number, y: number): 'left' | 'right' | null => {
    const inside = (el: HTMLDivElement | null) => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    }
    if (inside(rightRef.current)) return 'right'
    if (inside(leftRef.current)) return 'left'
    return null
  }

  const handleDrop = (order: Order, x: number, y: number) => {
    const column = columnAt(x, y)
    if (column === 'right' && !isCooked(order)) moveTo(order, 'served')
    if (column === 'left' && isCooked(order)) moveTo(order, 'preparing')
  }

  const renderCard = (order: Order) => (
    <DraggableCard
      key={order.id}
      onDragMove={(x, y) => setHover(columnAt(x, y))}
      onDrop={(x, y) => {
        setHover(null)
        handleDrop(order, x, y)
      }}
    >
      <OrderCard order={order} />
      {order.table_id === TAKEOUT_TABLE_ID && (
        <div className="mt-1">
          <LineContactButton order={order} />
        </div>
      )}
      {isCooked(order) && (
        <button
          type="button"
          onClick={() => markPaid(order)}
          className="mt-1 w-full py-3 rounded-xl text-base font-bold bg-matcha-600 text-white active:bg-matcha-500"
        >
          会計済みにする
        </button>
      )}
      <button
        type="button"
        onClick={() => moveTo(order, isCooked(order) ? 'preparing' : 'served')}
        className={`mt-1 w-full py-2 rounded-xl text-sm font-bold border ${
          isCooked(order)
            ? 'bg-white text-brown-500 border-cream-300'
            : 'bg-green-50 text-green-800 border-green-300 active:bg-green-100'
        }`}
      >
        {isCooked(order) ? '← 未調理に戻す' : '調理済みへ →'}
      </button>
    </DraggableCard>
  )

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div
          ref={leftRef}
          className={`md:col-span-2 rounded-2xl p-2 min-h-40 transition-colors ${
            hover === 'left' ? 'bg-amber-100' : 'bg-cream-100'
          }`}
        >
          <h2 className="text-sm font-bold text-amber-800 px-1 mb-2">未調理（{uncooked.length}件）</h2>
          {uncooked.length === 0 ? (
            <p className="text-center text-brown-300 py-8">未調理の注文はありません</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{uncooked.map(renderCard)}</div>
          )}
        </div>

        <div
          ref={rightRef}
          className={`rounded-2xl p-2 min-h-40 border-2 border-dashed transition-colors ${
            hover === 'right' ? 'bg-green-100 border-green-400' : 'bg-green-50/50 border-green-200'
          }`}
        >
          <h2 className="text-sm font-bold text-green-800 px-1 mb-2">調理済み（{cooked.length}件）</h2>
          {cooked.length === 0 ? (
            <p className="text-center text-brown-300 py-8 text-sm">ここへドラッグすると調理済みになります</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">{cooked.map(renderCard)}</div>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  )
}

/**
 * 横にドラッグできるカード（指でもマウスでも動く）
 * 縦の動きは画面のスクロールのまま。ドラッグした後は、カードを開く操作にしない。
 */
function DraggableCard({
  children,
  onDragMove,
  onDrop,
}: {
  children: React.ReactNode
  onDragMove: (x: number, y: number) => void
  onDrop: (x: number, y: number) => void
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const dragged = useRef(false)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)

  const end = (e: React.PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return
    if (offset) onDrop(e.clientX, e.clientY)
    start.current = null
    setOffset(null)
  }

  return (
    <div
      style={{
        touchAction: 'pan-y',
        transform: offset ? `translate(${offset.x}px, ${offset.y}px) rotate(1.5deg)` : undefined,
        zIndex: offset ? 50 : undefined,
        position: 'relative',
        transition: offset ? 'none' : 'transform 0.15s',
      }}
      className={offset ? 'shadow-2xl opacity-90' : ''}
      onPointerDown={(e) => {
        // ボタン類は普通に押せるようにする
        if ((e.target as HTMLElement).closest('button')) return
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
        dragged.current = false
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s || s.id !== e.pointerId) return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        if (!offset) {
          // 横方向にはっきり動かしたときだけドラッグにする（縦はスクロール）
          if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
          dragged.current = true
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }
        setOffset({ x: dx, y: dy })
        onDragMove(e.clientX, e.clientY)
      }}
      onPointerUp={end}
      onPointerCancel={(e) => {
        if (start.current?.id === e.pointerId) {
          start.current = null
          setOffset(null)
        }
      }}
      onClickCapture={(e) => {
        // ドラッグの終わりにカードが開かないようにする
        if (dragged.current) {
          e.preventDefault()
          e.stopPropagation()
          dragged.current = false
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
}
