'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import type { Order } from '@/lib/types'
import { calcOrderTotal, TABLE_NAMES, TOPPING_NAME, TOPPING_PRICE, storageUrl } from '@/lib/types'
import StatusBadge from '@/components/admin/StatusBadge'

interface Props {
  params: Promise<{ tableId: string }>
}

export default function CompletePage({ params }: Props) {
  const { tableId } = use(params)
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) { setLoading(false); return }

    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((data) => { setOrder(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [orderId])

  const tableName = TABLE_NAMES[tableId] ?? tableId
  const items = order?.order_items ?? []
  const total = calcOrderTotal(items)

  return (
    <div className="min-h-dvh bg-cream-50 flex flex-col">
      <header className="bg-cream-50/95 backdrop-blur border-b border-cream-300 px-4 py-2 flex justify-center">
        <Image
          src={storageUrl('logo.png')}
          alt="織はや"
          width={120}
          height={48}
          className="object-contain h-10 w-auto"
        />
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 flex flex-col gap-6">
        {/* 完了メッセージ */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-matcha-500 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl font-bold text-brown-700">
            ご注文ありがとうございます
          </h1>
          <p className="text-brown-500">{tableName}</p>
          {order && <StatusBadge status={order.status} />}
        </div>

        {/* 注文内容 */}
        {!loading && items.length > 0 && (
          <div className="card p-4 space-y-3">
            <h2 className="font-bold text-lg text-brown-700 border-b border-cream-300 pb-2">
              ご注文内容
            </h2>
            <div className="space-y-2">
              {items.map((item) => {
                const toppingCost = item.with_topping ? TOPPING_PRICE : 0
                const subtotal = (item.unit_price + toppingCost) * item.quantity

                return (
                  <div key={item.id} className="flex justify-between items-start">
                    <div>
                      <p className="text-base text-brown-800 font-medium">
                        {item.product?.name ?? '不明'}
                      </p>
                      {item.with_topping && (
                        <p className="text-sm text-brown-400">＋{TOPPING_NAME}</p>
                      )}
                      <p className="text-sm text-brown-400">
                        ¥{(item.unit_price + toppingCost).toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-bold text-brown-700 tabular-nums">
                      ¥{subtotal.toLocaleString()}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-cream-300">
              <span className="font-bold text-lg text-brown-800">合計</span>
              <span className="font-bold text-2xl text-brown-700 tabular-nums">
                ¥{total.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* お知らせ */}
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-brown-700 text-base leading-relaxed">
            まもなくご用意いたします。<br />
            お会計はお帰りの際、レジにてお申し付けください。
          </p>
        </div>

        {/* 追加注文ボタン */}
        <Link
          href={`/table/${tableId}`}
          className="btn-secondary text-center block text-xl py-4"
        >
          ＋ 追加注文する
        </Link>
      </main>
    </div>
  )
}
