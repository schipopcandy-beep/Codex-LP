'use client'

import CustomerFeatures from '@/components/admin/CustomerFeatures'
import Link from 'next/link'
import type { Order, OrderItem } from '@/lib/types'
import {
  calcOrderTotal,
  countOnigiri,
  TABLE_NAMES,
  optionLabel,
  optionPrice,
  DRINK_CATEGORY,
  DRINK_TIMING_LABELS,
  TAKEOUT_TABLE_ID,
  orderShortId,
  formatScheduleDate,
  getOrderBatchIndexes,
  groupLunchPlateNigiri,
  orderBatchLabel,
} from '@/lib/types'
import StatusBadge from './StatusBadge'

interface Props {
  order: Order
  /** 新規・調理中・提供済みなどのステータスも表示する（履歴用）。通常は「追加」のときだけ表示 */
  showStatus?: boolean
}

export default function OrderCard({ order, showStatus = false }: Props) {
  const items = order.order_items ?? []
  const total = calcOrderTotal(items)
  const onigiriCount = countOnigiri(items)

  // 明細を注文された回ごとに分ける（0 = 最初の注文, 1 = 追加1, 2 = 追加2…）
  const batchIndexes = getOrderBatchIndexes(items)
  const latestBatch = Math.max(0, ...items.map((i) => batchIndexes.get(i.id) ?? 0))
  // ランチプレートごとの中のおにぎり（プレートの行の下に並べる）
  const plateNigiri = groupLunchPlateNigiri(items)

  // 席から注文されたお持ち帰り分は、イートインの下にまとめて表示する
  const eatinItems = items.filter((i) => i.lunch_plate_index == null && !i.is_takeout)
  // 注文者ごとに分けたおにぎり（同じ人の分を1皿にまとめる）と、それ以外
  const dinerNumbers = [...new Set(eatinItems.map((i) => i.diner_no).filter((n): n is number => n != null))].sort(
    (a, b) => a - b,
  )
  const sharedItems = eatinItems.filter((i) => i.diner_no == null)
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
            {order.customer_name && (
              <p className="text-lg font-bold text-brown-800">{order.customer_name} 様</p>
            )}
            <CustomerFeatures features={order.customer_features} />
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xl font-bold text-brown-800 flex items-center gap-2 flex-wrap">
              {tableName}
              {onigiriCount > 0 && (
                <span className="text-base font-bold text-brown-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                  🍙 {onigiriCount}個
                </span>
              )}
            </p>
            <p className="text-sm text-brown-400 flex items-center gap-2">
              {createdAt} 〜
              {order.party_size && (
                <span className="text-brown-500 font-medium">{order.party_size}名</span>
              )}
            </p>
          </div>
          {/* ステータスは「追加」のときだけ表示（未調理・調理済みは列で分かるため） */}
          {(showStatus || order.status === 'added') && (
            <StatusBadge
              status={order.status}
              tableId={order.table_id}
              suffix={order.status === 'added' && latestBatch > 0 ? String(latestBatch) : undefined}
            />
          )}
        </div>

        <div className="space-y-1 mb-3">
          {dinerNumbers.map((n) => (
            <div key={`diner-${n}`} className="rounded-lg border border-brown-200 bg-white/60 px-2 py-1 space-y-0.5">
              <p className="text-xs font-bold text-brown-500">注文者{n}</p>
              {eatinItems
                .filter((i) => i.diner_no === n)
                .map((item) => (
                  <ItemLine key={item.id} item={item} batch={batchIndexes.get(item.id) ?? 0} />
                ))}
            </div>
          ))}
          {sharedItems.map((item) => (
            <div key={item.id}>
              <ItemLine item={item} batch={batchIndexes.get(item.id) ?? 0} />
              <PlateNigiri groups={plateNigiri.get(item.id)} />
            </div>
          ))}

          {/* 席から注文されたお持ち帰り分 */}
          {takeoutItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-amber-300 space-y-1">
              <p className="text-xs font-bold text-amber-700">お持ち帰り</p>
              {takeoutItems.map((item) => (
                <ItemLine key={item.id} item={item} batch={batchIndexes.get(item.id) ?? 0} />
              ))}
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

/** ランチプレートの中のおにぎり（プレート1枚ごと） */
function PlateNigiri({ groups }: { groups?: OrderItem[][] }) {
  if (!groups || groups.length === 0) return null
  return (
    <div className="pl-4 space-y-0.5">
      {groups.map((group, i) => (
        <p key={i} className="text-sm text-brown-600">
          {groups.length > 1 && <span className="text-brown-400 mr-1">{i + 1}枚目</span>}
          {group
            .map((n) => {
              const options = optionLabel(n)
              return `${n.product?.name ?? '不明'}${options ? `（${options}）` : ''}${n.quantity > 1 ? ` ×${n.quantity}` : ''}`
            })
            .join('・')}
        </p>
      ))}
    </div>
  )
}

/** 明細1行（回番号と、とろろ昆布・ドリンクのタイミングを添える） */
function ItemLine({ item, batch }: { item: OrderItem; batch: number }) {
  const isDrink = item.product?.category === DRINK_CATEGORY
  const timingLabel = isDrink && item.timing ? DRINK_TIMING_LABELS[item.timing] : null
  const batchLabel = orderBatchLabel(batch)
  // 2個以上は見落とさないよう赤字にする
  const isMultiple = item.quantity >= 2

  return (
    <p className={`text-sm flex justify-between ${isMultiple ? 'text-red-600 font-bold' : 'text-brown-600'}`}>
      <span>
        {batchLabel && (
          <span className="text-rose-600 font-bold mr-1">［{batchLabel}］</span>
        )}
        {item.product?.name ?? '不明'}
        {optionLabel(item) && (
          <span className="text-brown-400 ml-1">{optionLabel(item)}</span>
        )}
        {timingLabel && (
          <span className="text-blue-600 ml-1">（{timingLabel}）</span>
        )}
        <span className={isMultiple ? 'ml-1 text-base' : 'text-brown-400 ml-1'}>×{item.quantity}</span>
      </span>
      <span className="tabular-nums">
        ¥{((item.unit_price + (optionPrice(item))) * item.quantity).toLocaleString()}
      </span>
    </p>
  )
}
