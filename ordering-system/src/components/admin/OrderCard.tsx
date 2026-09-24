'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Order, OrderItem, OrderStatus } from '@/lib/types'
import {
  calcOrderTotal,
  TABLE_NAMES,
  TOPPING_CART_LABEL,
  TOPPING_PRICE,
  DRINK_CATEGORY,
  DRINK_TIMING_LABELS,
  TAKEOUT_TABLE_ID,
  orderShortId,
  formatScheduleDate,
  getOrderBatchIndexes,
  orderBatchLabel,
} from '@/lib/types'
import StatusBadge from './StatusBadge'

/** バッジタップで循環させる順序: 新規/追加 → 調理中 → 提供済み → 新規 */
const NEXT_STATUS: Record<OrderStatus, OrderStatus> = {
  new: 'preparing',
  added: 'preparing',
  preparing: 'served',
  served: 'new',
  paid: 'paid',
}

interface Props {
  order: Order
  /** ステータス変更後に一覧を再取得するコールバック */
  onStatusChanged?: () => void
}

export default function OrderCard({ order, onStatusChanged }: Props) {
  const [updating, setUpdating] = useState(false)

  const handleStatusTap = async (e: React.MouseEvent) => {
    // カード全体が詳細ページへの Link なので遷移を止める
    e.preventDefault()
    e.stopPropagation()
    if (updating || order.status === 'paid') return
    setUpdating(true)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: NEXT_STATUS[order.status] }),
    })
    if (res.ok) {
      onStatusChanged?.()
    } else {
      alert('ステータスの更新に失敗しました')
    }
    setUpdating(false)
  }
  const items = order.order_items ?? []
  const total = calcOrderTotal(items)

  // 明細を注文された回ごとに分ける（0 = 最初の注文, 1 = 追加1, 2 = 追加2…）
  const batchIndexes = getOrderBatchIndexes(items)
  const latestBatch = Math.max(0, ...items.map((i) => batchIndexes.get(i.id) ?? 0))

  // 席から注文されたお持ち帰り分は、イートインの下にまとめて表示する
  const eatinItems = items.filter((i) => i.lunch_plate_index == null && !i.is_takeout)
  const takeoutItems = items.filter((i) => i.lunch_plate_index == null && i.is_takeout)
  const tableName = TABLE_NAMES[order.table_id] ?? order.table_id
  const isTakeout = order.table_id === TAKEOUT_TABLE_ID
  const createdAt = new Date(order.created_at).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // 受取日時パース
  const pickupLabel = (() => {
    if (!order.pickup_at) return null
    const [datePart, timePart] = order.pickup_at.split(' ')
    return `${formatScheduleDate(datePart)} ${timePart}`
  })()

  return (
    <Link href={`/admin/orders/${order.id}`}>
      <div className="card p-4 hover:shadow-md transition-shadow active:bg-cream-200 cursor-pointer">

        {/* テイクアウト：受取日時・注文番号を目立つ表示 */}
        {isTakeout && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">テイクアウト</p>
              <p className="text-sm font-bold text-amber-800">No. {orderShortId(order.id)}</p>
            </div>
            {pickupLabel ? (
              <p className="text-xl font-bold text-amber-900">{pickupLabel} 受取</p>
            ) : (
              <p className="text-sm text-amber-600">受取日時 未設定</p>
            )}
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xl font-bold text-brown-800">{tableName}</p>
            <p className="text-sm text-brown-400 flex items-center gap-2">
              {createdAt} 〜
              {order.party_size && (
                <span className="text-brown-500 font-medium">{order.party_size}名</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleStatusTap}
            disabled={updating}
            className={`${updating ? 'opacity-50' : 'active:scale-95'} transition-transform`}
            title="タップでステータスを切り替え"
          >
            <StatusBadge
              status={order.status}
              tableId={order.table_id}
              suffix={order.status === 'added' && latestBatch > 0 ? String(latestBatch) : undefined}
            />
          </button>
        </div>

        <div className="space-y-1 mb-3">
          {eatinItems.slice(0, 3).map((item) => (
            <ItemLine key={item.id} item={item} batch={batchIndexes.get(item.id) ?? 0} />
          ))}
          {eatinItems.length > 3 && (
            <p className="text-sm text-brown-400">他 {eatinItems.length - 3} 品…</p>
          )}

          {/* 席から注文されたお持ち帰り分 */}
          {takeoutItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-amber-300 space-y-1">
              <p className="text-xs font-bold text-amber-700">お持ち帰り</p>
              {takeoutItems.slice(0, 3).map((item) => (
                <ItemLine key={item.id} item={item} batch={batchIndexes.get(item.id) ?? 0} />
              ))}
              {takeoutItems.length > 3 && (
                <p className="text-sm text-brown-400">他 {takeoutItems.length - 3} 品…</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-cream-300">
          <span className="text-sm text-brown-500">{items.length} 品目</span>
          <span className="text-xl font-bold text-brown-700 tabular-nums">
            ¥{total.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  )
}

/** 明細1行（回番号と、とろろ昆布・ドリンクのタイミングを添える） */
function ItemLine({ item, batch }: { item: OrderItem; batch: number }) {
  const isDrink = item.product?.category === DRINK_CATEGORY
  const timingLabel = isDrink && item.timing ? DRINK_TIMING_LABELS[item.timing] : null
  const batchLabel = orderBatchLabel(batch)

  return (
    <p className="text-sm text-brown-600 flex justify-between">
      <span>
        {batchLabel && (
          <span className="text-rose-600 font-bold mr-1">［{batchLabel}］</span>
        )}
        {item.product?.name ?? '不明'}
        {item.with_topping && (
          <span className="text-brown-400 ml-1">{TOPPING_CART_LABEL}</span>
        )}
        {timingLabel && (
          <span className="text-blue-600 ml-1">（{timingLabel}）</span>
        )}
        <span className="text-brown-400 ml-1">×{item.quantity}</span>
      </span>
      <span className="tabular-nums">
        ¥{((item.unit_price + (item.with_topping ? TOPPING_PRICE : 0)) * item.quantity).toLocaleString()}
      </span>
    </p>
  )
}
