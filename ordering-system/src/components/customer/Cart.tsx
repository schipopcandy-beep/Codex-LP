'use client'

import { useState } from 'react'
import type { CartItem, Product, DrinkTiming } from '@/lib/types'
import {
  calcCartTotal,
  TOPPING_NAME,
  TOPPING_PRICE,
  DRINK_TIMING_LABELS,
  DRINK_CATEGORY,
  getLunchPlateSurcharge,
} from '@/lib/types'
import LunchPlateSelector from '@/components/customer/LunchPlateSelector'

interface Props {
  items: CartItem[]
  onSubmit: () => Promise<void>
  isSubmitting: boolean
  /** ランチプレート選択UI用 */
  allProducts?: Product[]
  /** ランチプレート1枚ごとのおにぎり選択（配列長 = ランチプレート枚数） */
  lunchNigiriPerPlate?: Array<Map<string, number>>
  onLunchNigiriChange?: (index: number, next: Map<string, number>) => void
  /** ドリンクのタイミング変更 */
  onDrinkTimingChange?: (productId: string, timing: DrinkTiming) => void
}

export default function Cart({
  items,
  onSubmit,
  isSubmitting,
  allProducts = [],
  lunchNigiriPerPlate = [],
  onLunchNigiriChange,
  onDrinkTimingChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const baseTotal = calcCartTotal(items)
  const lunchSurcharge = lunchNigiriPerPlate.flatMap((plateMap) =>
    Array.from(plateMap.entries()).map(([productId, count]) => {
      const product = allProducts.find((p) => p.id === productId)
      return product ? getLunchPlateSurcharge(product) * count : 0
    })
  ).reduce((s, v) => s + v, 0)
  const total = baseTotal + lunchSurcharge

  const totalCount = items.reduce((s, i) => s + i.quantity, 0)

  const lunchPlateCount = lunchNigiriPerPlate.length
  const lunchPlateReady =
    lunchPlateCount === 0 ||
    lunchNigiriPerPlate.every(
      (map) => Array.from(map.values()).reduce((s, v) => s + v, 0) >= 2
    )

  const drinkItems = items.filter((item) => item.product.category === DRINK_CATEGORY)
  const drinksReady = drinkItems.every((item) => item.timing != null)

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
            {((lunchPlateCount > 0 && !lunchPlateReady) || !drinksReady) && (
              <span className="text-xs bg-amber-400 text-brown-900 px-2 py-0.5 rounded-full font-semibold">
                選択が必要です
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
                const isDrink = item.product.category === DRINK_CATEGORY

                return (
                  <div
                    key={`${item.product.id}-${item.with_topping}-${item.timing ?? ''}`}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between items-start gap-2">
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

                    {/* ドリンクのタイミング選択 */}
                    {isDrink && onDrinkTimingChange && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-brown-500 mr-1">タイミング：</span>
                        {(['before', 'with', 'after'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => onDrinkTimingChange(item.product.id, t)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                              item.timing === t
                                ? 'bg-brown-600 text-white border-brown-600'
                                : 'bg-white text-brown-600 border-brown-300 active:bg-cream-100'
                            }`}
                          >
                            {DRINK_TIMING_LABELS[t]}
                          </button>
                        ))}
                        {!item.timing && (
                          <span className="text-xs text-amber-600 ml-1">要選択</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* ランチプレート おにぎり選択（プレート別） */}
              {lunchPlateCount > 0 && onLunchNigiriChange &&
                lunchNigiriPerPlate.map((plateMap, i) => (
                  <LunchPlateSelector
                    key={i}
                    products={allProducts}
                    selections={plateMap}
                    plateLabel={lunchPlateCount > 1 ? `${i + 1}枚目` : undefined}
                    onChange={(next) => onLunchNigiriChange(i, next)}
                  />
                ))
              }
            </div>

            <div className="px-4 py-4 border-t border-cream-300 space-y-3">
              {lunchSurcharge > 0 && (
                <div className="flex justify-between items-center text-sm text-amber-700">
                  <span>ランチプレート追加料金</span>
                  <span className="tabular-nums">+¥{lunchSurcharge.toLocaleString()}</span>
                </div>
              )}
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
                  ランチプレートのおにぎり（各2つ）を選んでから注文できます
                </p>
              )}
              {!drinksReady && (
                <p className="text-center text-sm text-amber-700 font-medium">
                  ドリンクのタイミングを選んでから注文できます
                </p>
              )}
              <button
                onClick={async () => { await onSubmit(); setIsOpen(false) }}
                disabled={isSubmitting || !lunchPlateReady || !drinksReady}
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
