'use client'

import { useState } from 'react'
import type { CartItem, CartPlate, Product } from '@/lib/types'
import {
  calcCartTotal,
  calcPlatePrice,
  optionLabel,
  optionPrice,
} from '@/lib/types'
import TonjiruSuggestion from '@/components/customer/TonjiruSuggestion'

interface Props {
  items: CartItem[]
  /** カートに入れたランチプレート（中のおにぎりは選び終えている） */
  plates?: CartPlate[]
  onSubmit: () => Promise<void>
  isSubmitting: boolean
  /** 人数（2名以上のときだけ、カートを「○人目」ごとに分けて表示する。0 = 分けない） */
  dinerCount?: number
  /** ランチプレートの金額・中のおにぎりの名前に使う */
  allProducts?: Product[]
  /** カートの個数変更（delta: +1 / -1） */
  onQuantityChange?: (item: CartItem, delta: number) => void
  /** カートから商品を削除 */
  onItemDelete?: (item: CartItem) => void
  /** ランチプレートを1枚削除 */
  onPlateDelete?: (plate: CartPlate) => void
  /** 商品をカートに追加（豚汁おすすめ用） */
  onAddItem?: (product: Product) => void
  /** おすすめする豚汁商品（カートになければ「豚汁を追加」を出す） */
  tonjiruProduct?: Product
  /** 豚汁を追加する先の表示（例: "2人目"） */
  tonjiruTargetLabel?: string
}

export default function Cart({
  items,
  plates = [],
  onSubmit,
  isSubmitting,
  dinerCount = 0,
  allProducts = [],
  onQuantityChange,
  onItemDelete,
  onPlateDelete,
  onAddItem,
  tonjiruProduct,
  tonjiruTargetLabel,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const hasTonjiru = tonjiruProduct ? items.some((i) => i.product.id === tonjiruProduct.id) : true

  const total = calcCartTotal(items) + plates.reduce((sum, p) => sum + calcPlatePrice(p, allProducts), 0)
  const totalCount = items.reduce((s, i) => s + i.quantity, 0) + plates.length

  const eatinCartItems = items.filter((item) => !item.is_takeout)
  const takeoutCartItems = items.filter((item) => item.is_takeout)
  const diners = Array.from({ length: dinerCount }, (_, i) => i + 1)

  /** カート1行分（店内分・お持ち帰り分で共通） */
  const renderCartItem = (item: CartItem) => {
    const toppingCost = optionPrice(item)
    const subtotal = (item.product.price + toppingCost) * item.quantity
    const options = optionLabel(item)

    return (
      <div
        key={`${item.product.id}-${item.with_topping}-${!!item.with_egg_yolk}-${!!item.with_large}-${item.timing ?? ''}-${item.is_takeout ? 'takeout' : ''}-${item.diner_no ?? ''}`}
        className="space-y-1.5"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base text-brown-800">
              {item.product.name}
              {options && (
                <span className="ml-1 text-sm text-brown-500 font-normal">
                  （{options}）
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

        {/* 個数変更・削除 */}
        {(onQuantityChange || onItemDelete) && (
          <div className="flex items-center justify-between gap-2">
            {onQuantityChange && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onQuantityChange(item, -1)}
                  aria-label="1つ減らす"
                  className="w-8 h-8 rounded-full border border-brown-400 text-brown-600 font-bold text-xl leading-none flex items-center justify-center active:bg-brown-100"
                >
                  −
                </button>
                <span className="w-5 text-center font-bold text-brown-800 tabular-nums">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(item, 1)}
                  aria-label="1つ増やす"
                  className="w-8 h-8 rounded-full border border-brown-400 text-brown-600 font-bold text-xl leading-none flex items-center justify-center active:bg-brown-100"
                >
                  ＋
                </button>
              </div>
            )}
            {onItemDelete && (
              <button
                type="button"
                onClick={() => onItemDelete(item)}
                className="text-xs text-brown-400 underline underline-offset-2 px-1 py-1"
              >
                削除
              </button>
            )}
          </div>
        )}

      </div>
    )
  }

  /** ランチプレート1枚分 */
  const renderPlate = (plate: CartPlate) => (
    <div key={plate.id} className="space-y-1">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-brown-800">{plate.product.name}</p>
          <p className="text-sm text-brown-500">
            {plate.units
              .map((u) => {
                const name = allProducts.find((p) => p.id === u.productId)?.name ?? ''
                const options = optionLabel({ with_topping: u.tororo, with_egg_yolk: u.eggYolk, with_large: u.large })
                return options ? `${name}（${options}）` : name
              })
              .join('・')}
          </p>
        </div>
        <p className="font-bold text-brown-700 tabular-nums whitespace-nowrap">
          ¥{calcPlatePrice(plate, allProducts).toLocaleString()}
        </p>
      </div>
      {onPlateDelete && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onPlateDelete(plate)}
            className="text-xs text-brown-400 underline underline-offset-2 px-1 py-1"
          >
            削除
          </button>
        </div>
      )}
    </div>
  )

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
              {/* 豚汁のおすすめ（カートになければ1行で出す） */}
              {tonjiruProduct && !hasTonjiru && onAddItem && (
                <TonjiruSuggestion
                  product={tonjiruProduct}
                  targetLabel={tonjiruTargetLabel}
                  onAdd={() => onAddItem(tonjiruProduct)}
                />
              )}

              {diners.length > 0 ? (
                // 2名以上: お一人ずつ1皿にまとめてお出しするので、人ごとに分けて表示する
                diners.map((n) => {
                  const dinerItems = eatinCartItems.filter((i) => i.diner_no === n)
                  const dinerPlates = plates.filter((p) => p.diner_no === n)
                  if (dinerItems.length === 0 && dinerPlates.length === 0) return null
                  return (
                    <div key={n} className="space-y-3 rounded-xl border border-cream-300 bg-white/60 p-3">
                      <p className="text-sm font-bold text-brown-600">{n}人目</p>
                      {dinerPlates.map(renderPlate)}
                      {dinerItems.map(renderCartItem)}
                    </div>
                  )
                })
              ) : (
                <>
                  {plates.map(renderPlate)}
                  {eatinCartItems.map(renderCartItem)}
                </>
              )}
              {/* 人数を分ける前に入れたものなど、人の指定がない店内分 */}
              {diners.length > 0 && (
                <>
                  {plates.filter((p) => !p.diner_no).map(renderPlate)}
                  {eatinCartItems.filter((i) => !i.diner_no).map(renderCartItem)}
                </>
              )}

              {/* 店内のご注文と一緒に頼んだお持ち帰り分 */}
              {takeoutCartItems.length > 0 && (
                <div className="pt-3 border-t border-dashed border-amber-300 space-y-3">
                  <p className="text-sm font-bold text-amber-700">お持ち帰り（お会計時にお渡し）</p>
                  {takeoutCartItems.map(renderCartItem)}
                </div>
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
              <button
                onClick={async () => {
                  await onSubmit()
                  setIsOpen(false)
                }}
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
