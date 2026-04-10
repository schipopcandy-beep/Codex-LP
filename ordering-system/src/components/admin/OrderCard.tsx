import Link from 'next/link'
import type { Order } from '@/lib/types'
import {
  calcOrderTotal,
  TABLE_NAMES,
  TOPPING_NAME,
  TOPPING_PRICE,
  DRINK_CATEGORY,
  DRINK_TIMING_LABELS,
  TAKEOUT_TABLE_ID,
  orderShortId,
  formatScheduleDate,
} from '@/lib/types'
import StatusBadge from './StatusBadge'

interface Props {
  order: Order
}

export default function OrderCard({ order }: Props) {
  const items = order.order_items ?? []
  const total = calcOrderTotal(items)
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
          <StatusBadge status={order.status} tableId={order.table_id} />
        </div>

        <div className="space-y-1 mb-3">
          {items.filter((i) => i.lunch_plate_index == null).slice(0, 3).map((item) => {
            const isDrink = item.product?.category === DRINK_CATEGORY
            const timingLabel = isDrink && item.timing ? DRINK_TIMING_LABELS[item.timing] : null
            return (
              <p key={item.id} className="text-sm text-brown-600 flex justify-between">
                <span>
                  {item.product?.name ?? '不明'}
                  {item.with_topping && (
                    <span className="text-brown-400 ml-1">+{TOPPING_NAME}</span>
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
          })}
          {items.length > 3 && (
            <p className="text-sm text-brown-400">他 {items.length - 3} 品…</p>
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
