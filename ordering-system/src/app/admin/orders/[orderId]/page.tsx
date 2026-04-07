'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Order, OrderStatus, OrderItem } from '@/lib/types'
import {
  calcOrderTotal,
  TABLE_NAMES,
  ORDER_STATUS_LABELS,
  TOPPING_NAME,
  TOPPING_PRICE,
  DRINK_CATEGORY,
  DRINK_TIMING_LABELS,
  LUNCH_PLATE_NAME,
} from '@/lib/types'
import StatusBadge from '@/components/admin/StatusBadge'

interface Props {
  params: Promise<{ orderId: string }>
}

const STATUS_FLOW: OrderStatus[] = ['new', 'preparing', 'served', 'paid']

export default function OrderDetailPage({ params }: Props) {
  const { orderId } = use(params)
  const router = useRouter()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}`)
    if (res.ok) {
      const data = await res.json()
      setOrder(data)
    }
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order || updating) return
    setUpdating(true)

    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (res.ok) {
      const updated = await res.json()
      setOrder((prev) => prev ? { ...prev, status: updated.status } : null)
    } else {
      alert('ステータスの更新に失敗しました')
    }
    setUpdating(false)
  }

  const handlePaid = async () => {
    if (!confirm('会計済みにしますか？')) return
    await handleStatusChange('paid')
    router.push('/admin')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-5xl animate-bounce">🍙</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-6 text-center">
        <p className="text-brown-500">注文が見つかりません</p>
        <Link href="/admin" className="text-brown-600 underline mt-2 inline-block">
          一覧に戻る
        </Link>
      </div>
    )
  }

  const items = order.order_items ?? []
  const total = calcOrderTotal(items)
  const tableName = TABLE_NAMES[order.table_id] ?? order.table_id

  // アイテムを種別ごとに分類
  const regularItems = items.filter(
    (i) => i.lunch_plate_index == null && i.product?.category !== DRINK_CATEGORY,
  )
  const lunchPlateBaseItems = regularItems.filter((i) => i.product?.name === LUNCH_PLATE_NAME)
  const otherItems = regularItems.filter((i) => i.product?.name !== LUNCH_PLATE_NAME)
  const lunchNigiriItems = items.filter((i) => i.lunch_plate_index != null)
  const drinkItems = items.filter((i) => i.product?.category === DRINK_CATEGORY)

  // ランチプレート内おにぎりをプレート番号でグループ化
  const nigiriByPlate = new Map<number, OrderItem[]>()
  for (const item of lunchNigiriItems) {
    const idx = item.lunch_plate_index ?? 0
    if (!nigiriByPlate.has(idx)) nigiriByPlate.set(idx, [])
    nigiriByPlate.get(idx)!.push(item)
  }
  const plateCount = lunchPlateBaseItems.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* ナビゲーション */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-brown-500 hover:text-brown-700 mb-4 text-base"
      >
        ← 一覧に戻る
      </Link>

      {/* タイトル */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-brown-700">{tableName}</h1>
          <p className="text-sm text-brown-400">
            {new Date(order.created_at).toLocaleString('ja-JP')}
          </p>
        </div>
        <StatusBadge status={order.status} size="md" />
      </div>

      {/* ステータス変更 */}
      {order.status !== 'paid' && (
        <div className="card p-4 mb-4">
          <p className="text-sm font-bold text-brown-600 mb-3">ステータスを変更：</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FLOW.filter((s) => s !== 'paid').map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={updating || order.status === status}
                className={`px-4 py-2 rounded-xl text-base font-bold border transition-colors ${
                  order.status === status
                    ? 'bg-brown-600 text-white border-brown-600'
                    : 'bg-cream-100 text-brown-700 border-cream-300 hover:bg-cream-200'
                } disabled:opacity-50`}
              >
                {ORDER_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 注文明細 */}
      <div className="card p-4 mb-4">
        <h2 className="font-bold text-lg text-brown-700 mb-3 border-b border-cream-300 pb-2">
          注文明細
        </h2>
        <div className="space-y-4">

          {/* 通常アイテム */}
          {otherItems.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}

          {/* ランチプレート */}
          {lunchPlateBaseItems.map((item) => {
            const subtotal = item.unit_price * item.quantity
            return (
              <div key={item.id}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-base font-bold text-brown-800">{item.product?.name ?? 'ランチプレート'}</p>
                    <p className="text-sm text-brown-400">¥{item.unit_price.toLocaleString()} × {item.quantity}</p>
                  </div>
                  <p className="font-bold text-brown-700 text-base tabular-nums whitespace-nowrap pl-2">
                    ¥{subtotal.toLocaleString()}
                  </p>
                </div>

                {/* プレート別おにぎり */}
                {Array.from({ length: plateCount }, (_, i) => {
                  const nigiri = nigiriByPlate.get(i) ?? []
                  return (
                    <div key={i} className="mt-2 ml-3 pl-3 border-l-2 border-amber-300">
                      {plateCount > 1 && (
                        <p className="text-xs font-bold text-amber-700 mb-1">{i + 1}枚目</p>
                      )}
                      {nigiri.length === 0 ? (
                        <p className="text-xs text-brown-400">おにぎり未選択</p>
                      ) : (
                        nigiri.map((n) => {
                          const surcharge = n.unit_price
                          return (
                            <p key={n.id} className="text-sm text-brown-600">
                              {n.product?.name ?? '不明'}
                              {surcharge > 0 && (
                                <span className="text-amber-600 ml-1 text-xs">+¥{surcharge}</span>
                              )}
                              {n.quantity > 1 && (
                                <span className="text-brown-400 ml-1">×{n.quantity}</span>
                              )}
                            </p>
                          )
                        })
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* ドリンク */}
          {drinkItems.length > 0 && (
            <div>
              <p className="text-xs font-bold text-brown-500 mb-2 uppercase tracking-wide">ドリンク</p>
              {drinkItems.map((item) => {
                const subtotal = item.unit_price * item.quantity
                const timingLabel = item.timing ? DRINK_TIMING_LABELS[item.timing] : null
                return (
                  <div key={item.id} className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="text-base font-bold text-brown-800">
                        {item.product?.name ?? '不明商品'}
                        {timingLabel && (
                          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {timingLabel}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-brown-400">¥{item.unit_price.toLocaleString()} × {item.quantity}</p>
                    </div>
                    <p className="font-bold text-brown-700 text-base tabular-nums whitespace-nowrap pl-2">
                      ¥{subtotal.toLocaleString()}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-cream-300">
          <span className="text-xl font-bold text-brown-800">合計</span>
          <span className="text-3xl font-bold text-brown-700 tabular-nums">
            ¥{total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 会計ボタン */}
      {order.status !== 'paid' && (
        <button
          onClick={handlePaid}
          disabled={updating}
          className="w-full py-5 rounded-2xl bg-matcha-600 text-white text-2xl font-bold shadow-lg active:bg-matcha-500 disabled:opacity-50"
        >
          会計済みにする
        </button>
      )}

      {order.status === 'paid' && (
        <div className="text-center py-4 text-brown-400 text-lg">
          この注文は会計済みです
        </div>
      )}
    </div>
  )
}

function ItemRow({ item }: { item: OrderItem }) {
  const toppingCost = item.with_topping ? TOPPING_PRICE : 0
  const subtotal = (item.unit_price + toppingCost) * item.quantity
  return (
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <p className="text-base font-bold text-brown-800">
          {item.product?.name ?? '不明商品'}
        </p>
        {item.with_topping && (
          <p className="text-sm text-brown-400">＋{TOPPING_NAME}</p>
        )}
        <p className="text-sm text-brown-400">
          ¥{(item.unit_price + toppingCost).toLocaleString()} × {item.quantity}
        </p>
      </div>
      <p className="font-bold text-brown-700 text-base tabular-nums whitespace-nowrap pl-2">
        ¥{subtotal.toLocaleString()}
      </p>
    </div>
  )
}
