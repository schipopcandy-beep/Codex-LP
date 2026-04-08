'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import type { Order } from '@/lib/types'
import { calcOrderTotal, TOPPING_NAME, TOPPING_PRICE, storageUrl, formatScheduleDate } from '@/lib/types'

function TakeoutCompleteContent() {
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

  const items = order?.order_items ?? []
  const total = calcOrderTotal(items)

  // pickup_at: "YYYY-MM-DD HH:MM" 形式
  const pickupAt = (order as (Order & { pickup_at?: string }) | null)?.pickup_at
  const pickupLabel = pickupAt
    ? (() => {
        const [datePart, timePart] = pickupAt.split(' ')
        return `${formatScheduleDate(datePart)} ${timePart}`
      })()
    : null

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
          <p className="text-brown-500 text-sm">テイクアウト</p>
        </div>

        {/* 受取日時 */}
        {pickupLabel && (
          <div className="card p-4 bg-brown-50 border-brown-200 text-center space-y-1">
            <p className="text-sm text-brown-500 font-medium">受取予定日時</p>
            <p className="text-2xl font-bold text-brown-800">{pickupLabel}</p>
          </div>
        )}

        {/* LINE通知のお知らせ */}
        <div className="card p-4 bg-[#06C755]/10 border-[#06C755]/30 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#06C755] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg viewBox="0 0 48 48" className="w-5 h-5 fill-white">
              <path d="M24 4C12.95 4 4 11.82 4 21.4c0 5.92 3.56 11.14 9.02 14.34-.35 1.32-1.28 4.8-1.47 5.54-.24.91.33 1.9 1.28 1.42.76-.39 9.54-6.3 11.57-7.67.51.06 1.03.09 1.6.09 11.05 0 20-7.82 20-17.4C46 11.82 35.05 4 24 4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-brown-800 mb-0.5">LINEに注文内容を送信しました</p>
            <p className="text-xs text-brown-500">LINEのメッセージで注文内容をご確認いただけます</p>
          </div>
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
            お受け取りの際はレジにてお声がけください。
          </p>
        </div>

        {/* 追加注文 */}
        <Link href="/takeout" className="btn-secondary text-center block text-xl py-4">
          ＋ 追加注文する
        </Link>
      </main>
    </div>
  )
}

export default function TakeoutCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-cream-50">
          <p className="text-brown-400 text-lg">読み込み中...</p>
        </div>
      }
    >
      <TakeoutCompleteContent />
    </Suspense>
  )
}
