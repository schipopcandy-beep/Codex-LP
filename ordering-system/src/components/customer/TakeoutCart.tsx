'use client'

import { useState } from 'react'
import type { CartItem } from '@/lib/types'
import { calcCartTotal, TOPPING_NAME, TOPPING_PRICE } from '@/lib/types'

interface Props {
  items: CartItem[]
  onSubmit: () => Promise<void>
  isSubmitting: boolean
}

export default function TakeoutCart({ items, onSubmit, isSubmitting }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const total = calcCartTotal(items)
  const totalCount = items.reduce((s, i) => s + i.quantity, 0)

  if (totalCount === 0) return null

  return (
    <>
      {/* カートバー（下部固定） */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-brown-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-3 flex-1"
          >
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{totalCount}</span>
            </div>
            <span className="font-bold text-lg">カートを見る</span>
          </button>
          <span className="font-bold text-xl tabular-nums">
            ¥{total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* カートドロワー */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />

          <div className="relative bg-cream-50 rounded-t-3xl max-h-[85dvh] flex flex-col shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-brown-300 rounded-full" />
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-cream-300">
              <h2 className="section-title text-xl">ご注文内容</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-brown-400 text-3xl leading-none p-1"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
              {items.map((item) => {
                const toppingCost = item.with_topping ? TOPPING_PRICE : 0
                const subtotal = (item.product.price + toppingCost) * item.quantity

                return (
                  <div
                    key={`${item.product.id}-${item.with_topping}`}
                    className="flex justify-between items-start gap-2"
                  >
                    <div className="flex-1">
                      <p className="font-bold text-base text-brown-800">
                        {item.product.name}
                        {item.with_topping && (
                          <span className="ml-1 text-sm text-brown-500 font-normal">
                            ＋{TOPPING_NAME}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-brown-500">
                        ¥{(item.product.price + toppingCost).toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-bold text-brown-700 tabular-nums whitespace-nowrap">
                      ¥{subtotal.toLocaleString()}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="px-4 py-4 border-t border-cream-300 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-brown-800">合計</span>
                <span className="text-2xl font-bold text-brown-700 tabular-nums">
                  ¥{total.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-brown-400 text-center">
                ※ お会計はレジにてお願いします
              </p>
              <button
                onClick={async () => { await onSubmit(); setIsOpen(false) }}
                disabled={isSubmitting}
                className="btn-primary w-full text-xl py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '送信中...' : '注文を確定する'}
              </button>
            </div>

            <div className="pb-safe" />
          </div>
        </div>
      )}
    </>
  )
}
