import Link from 'next/link'
import type { Order } from '@/lib/types'
import { calcOrderTotal, TABLE_NAMES, TOPPING_NAME, TOPPING_PRICE, DRINK_CATEGORY, DRINK_TIMING_LABELS } from '@/lib/types'
import StatusBadge from './StatusBadge'

interface Props {
  order: Order
}

export default function OrderCard({ order }: Props) {
  const items = order.order_items ?? []
  const total = calcOrderTotal(items)
  const tableName = TABLE_NAMES[order.table_id] ?? order.table_id
  const createdAt = new Date(order.created_at).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link href={`/admin/orders/${order.id}`}>
      <div className="card p-4 hover:shadow-md transition-shadow active:bg-cream-200 cursor-pointer">
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
          <StatusBadge status={order.status} />
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
            <p className="text-sm text-brown-400">
              他 {items.length - 3} 品…
            </p>
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
