'use client'

import { useState } from 'react'
import type { CartItem, Product } from '@/lib/types'
import { calcCartTotal, TOPPING_NAME, TOPPING_PRICE } from '@/lib/types'
import PickupDateTimePicker from '@/components/customer/PickupDateTimePicker'

interface Props {
  items: CartItem[]
  onSubmit: () => Promise<void>
  isSubmitting: boolean
  pickupDate: string | null
  pickupTime: string | null
  onPickupSelect: (date: string, time: string) => void
  /** 商品をカートに追加（豚汁おすすめ用） */
  onAddItem?: (product: Product, withTopping: boolean) => void
  /** おすすめする豚汁商品（渡された場合のみポップアップ表示） */
  tonjiruProduct?: Product
}

export default function TakeoutCart({
  items,
  onSubmit,
  isSubmitting,
  pickupDate,
  pickupTime,
  onPickupSelect,
  onAddItem,
  tonjiruProduct,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [showTonjiruPopup, setShowTonjiruPopup] = useState(false)

  const total = calcCartTotal(items)
  const totalCount = items.reduce((s, i) => s + i.quantity, 0)
  const pickupReady = !!(pickupDate && pickupTime)
  const canSubmit = pickupReady && confirmed

  const hasTonjiru = tonjiruProduct
    ? items.some((i) => i.product.id === tonjiruProduct.id)
    : true

  function handleCartOpen() {
    if (tonjiruProduct && !hasTonjiru) {
      setShowTonjiruPopup(true)
    } else {
      setIsOpen(true)
    }
  }

  if (totalCount === 0) return null

  return (
    <>
      {/* カートバー（下部固定） */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-brown-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <button
            onClick={handleCartOpen}
            className="flex items-center gap-3 flex-1"
          >
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{totalCount}</span>
            </div>
            <span className="font-bold text-lg">カートを見る</span>
            {!pickupReady && (
              <span className="text-xs bg-amber-400 text-brown-900 px-2 py-0.5 rounded-full font-semibold">
                受取日時未選択
              </span>
            )}
          </button>
          <span className="font-bold text-xl tabular-nums">
            ¥{total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 豚汁おすすめポップアップ */}
      {showTonjiruPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTonjiruPopup(false)} />
          <div className="relative bg-cream-50 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <div className="text-center space-y-2">
              <p className="text-4xl">🍲</p>
              <h3 className="text-xl font-bold text-brown-800">豚汁はいかがですか？</h3>
              <p className="text-sm text-brown-500">
                おにぎりとの相性抜群です。<br />ご一緒にどうぞ！
              </p>
            </div>
            <button
              onClick={() => {
                if (tonjiruProduct && onAddItem) onAddItem(tonjiruProduct, false)
                setShowTonjiruPopup(false)
                setIsOpen(true)
              }}
              className="btn-primary w-full py-3 text-base"
            >
              追加する
            </button>
            <button
              onClick={() => { setShowTonjiruPopup(false); setIsOpen(true) }}
              className="w-full py-3 text-sm text-brown-500 underline underline-offset-2"
            >
              このまま注文する
            </button>
          </div>
        </div>
      )}

      {/* カートドロワー */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setIsOpen(false); setConfirmed(false) }} />

          <div className="relative bg-cream-50 rounded-t-3xl max-h-[90dvh] overflow-y-auto shadow-2xl">
            {/* ドラッグハンドル＋ヘッダー（sticky で常に見える） */}
            <div className="sticky top-0 bg-cream-50 z-10">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-brown-300 rounded-full" />
              </div>
              <div className="px-4 py-2 flex items-center justify-between border-b border-cream-300">
                <h2 className="section-title text-xl">ご注文内容</h2>
                <button
                  onClick={() => { setIsOpen(false); setConfirmed(false) }}
                  className="text-brown-400 text-3xl leading-none p-1"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 全コンテンツを1本スクロール */}
            <div className="px-4 py-3 space-y-4">
              {/* 注文明細 */}
              <div className="space-y-3">
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

              {/* 受取日時選択 */}
              <div className="border-t border-cream-300 pt-4">
                <p className="font-bold text-brown-700 mb-1">受取日時を選択</p>
                <p className="text-xs text-brown-400 mb-3">
                  ※ 注文から1時間後以降の時間帯のみ選択できます
                </p>
                <PickupDateTimePicker
                  selectedDate={pickupDate}
                  selectedTime={pickupTime}
                  onSelect={onPickupSelect}
                />
              </div>

              {/* 合計・確認・注文ボタン */}
              <div className="border-t border-cream-300 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-brown-800">合計</span>
                  <span className="text-2xl font-bold text-brown-700 tabular-nums">
                    ¥{total.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-brown-400 text-center">
                  ※ お会計はレジにてお願いします
                </p>
                {!pickupReady && (
                  <p className="text-center text-sm text-amber-700 font-medium">
                    受取日時を選んでから注文できます
                  </p>
                )}

                {/* 注文確認チェックボックス */}
                <div className="border border-cream-300 rounded-xl p-3 bg-white space-y-2">
                  <p className="text-sm font-semibold text-brown-700">ご注文にお間違えはありませんか？</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="w-5 h-5 accent-brown-600 cursor-pointer"
                    />
                    <span className="text-sm text-brown-800 font-medium">はい、間違いありません。</span>
                  </label>
                </div>

                <button
                  onClick={async () => { await onSubmit(); setIsOpen(false); setConfirmed(false) }}
                  disabled={isSubmitting || !canSubmit}
                  className="btn-primary w-full text-xl py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '送信中...' : '注文を確定する'}
                </button>
              </div>
            </div>

            <div className="pb-safe" />
          </div>
        </div>
      )}
    </>
  )
}
