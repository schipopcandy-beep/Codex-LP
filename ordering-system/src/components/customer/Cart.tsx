'use client'

import { useState } from 'react'
import type { CartItem, Product } from '@/lib/types'
import { calcCartTotal, TOPPING_NAME, TOPPING_PRICE } from '@/lib/types'
import LunchPlateSelector from '@/components/customer/LunchPlateSelector'

interface Props {
  items: CartItem[]
  onSubmit: () => Promise<void>
  isSubmitting: boolean
  /** ランチプレート選択UI用 */
  allProducts?: Product[]
  lunchPlateCount?: number
  lunchNigiri?: Map<string, number>
  onLunchNigiriChange?: (next: Map<string, number>) => void
}

export default function Cart({
  items,
  onSubmit,
  isSubmitting,
  allProducts = [],
  lunchPlateCount = 0,
  lunchNigiri = new Map(),
  onLunchNigiriChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const total = calcCartTotal(items)
  const totalCount = items.reduce((s, i) => s + i.quantity, 0)

  const requiredNigiri = lunchPlateCount * 2
  const selectedNigiri = Array.from(lunchNigiri.values()).reduce((s, v) => s + v, 0)
  const lunchPlateReady = lunchPlateCount === 0 || selectedNigiri >= requiredNigiri

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
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{totalCount}</span>
              </div>
            </div>
            <span className="font-bold text-lg">カートを見る</span>
            {lunchPlateCount > 0 && !lunchPlateReady && (
              <span className="text-xs bg-amber-400 text-brown-900 px-2 py-0.5 rounded-full font-semibold">
                おにぎりを選んでください
              </span>
            )}
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
                  <div key={`${item.product.id}-${item.with_topping}`} className="flex justify-between items-start gap-2">
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

              {/* ランチプレート おにぎり選択 */}
              {lunchPlateCount > 0 && onLunchNigiriChange && (
                <LunchPlateSelector
                  products={allProducts}
                  selections={lunchNigiri}
                  totalRequired={requiredNigiri}
                  onChange={onLunchNigiriChange}
                />
              )}
            </div>

            <div className="px-4 py-4 border-t border-cream-300 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-brown-800">合計</span>
                <span className="text-2xl font-bold text-brown-700 tabular-nums">
                  ¥{total.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-brown-400 text-center">
                ※ お会計はレジにて対面でお願いします
              </p>
              {lunchPlateCount > 0 && !lunchPlateReady && (
                <p className="text-center text-sm text-amber-700 font-medium">
                  ランチプレートのおにぎり（{requiredNigiri}つ）を選んでから注文できます
                </p>
              )}
              <button
                onClick={async () => { await onSubmit(); setIsOpen(false) }}
                disabled={isSubmitting || !lunchPlateReady}
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
