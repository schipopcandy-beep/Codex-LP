'use client'

import type { CartItem, NigiriOptions, OptionSoldOut } from '@/lib/types'
import {
  EGG_YOLK_NAME,
  EGG_YOLK_PRICE,
  LARGE_CART_LABEL,
  LARGE_PRICE,
  NO_OPTION_SOLD_OUT,
  TOPPING_NAME,
  TOPPING_PRICE,
  isToppingSelectable,
  optionsOfItem,
} from '@/lib/types'

interface Props {
  items: CartItem[]
  optionSoldOut?: OptionSoldOut
  /** カートの1行のオプションを変える（その行の全部の個数に付く） */
  onOptionsChange: (item: CartItem, options: NigiriOptions) => void
}

const OPTIONS: { key: keyof NigiriOptions; soldOutKey: keyof OptionSoldOut; label: string; price: number }[] = [
  { key: 'large', soldOutKey: 'large', label: LARGE_CART_LABEL, price: LARGE_PRICE },
  { key: 'eggYolk', soldOutKey: 'egg_yolk', label: EGG_YOLK_NAME, price: EGG_YOLK_PRICE },
  { key: 'tororo', soldOutKey: 'tororo', label: TOPPING_NAME, price: TOPPING_PRICE },
]

/**
 * 注文前のおすすめ（豚汁のポップアップの下）に出す、おにぎりのトッピング
 * カートのおにぎりごとに、ボタンでトッピングを付け外しできる
 */
export default function ToppingSuggestions({ items, optionSoldOut = NO_OPTION_SOLD_OUT, onOptionsChange }: Props) {
  const nigiriItems = items.filter((i) => isToppingSelectable(i.product))
  const available = OPTIONS.filter((o) => !optionSoldOut[o.soldOutKey])
  if (nigiriItems.length === 0 || available.length === 0) return null

  return (
    <div className="border-t border-cream-300 pt-4 space-y-3">
      <div className="text-center">
        <p className="text-base font-bold text-brown-800">おにぎりのトッピングもおすすめです</p>
        <p className="text-xs text-brown-500">押すと、そのおにぎりに付きます（もう一度押すと外れます）</p>
      </div>
      {nigiriItems.map((item) => {
        const current = optionsOfItem(item)
        return (
          <div
            key={`${item.product.id}-${item.with_topping}-${!!item.with_egg_yolk}-${!!item.with_large}-${item.is_takeout ? 't' : ''}`}
            className="space-y-1.5"
          >
            <p className="text-sm font-bold text-brown-700">
              {item.product.name}
              <span className="text-brown-400 font-normal ml-1">×{item.quantity}</span>
              {item.is_takeout && <span className="text-amber-700 text-xs ml-1">お持ち帰り</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {available.map((o) => {
                const on = current[o.key]
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => onOptionsChange(item, { ...current, [o.key]: !on })}
                    aria-pressed={on}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 ${
                      on
                        ? 'bg-brown-600 border-brown-600 text-white'
                        : 'bg-white border-cream-300 text-brown-600 active:bg-cream-200'
                    }`}
                  >
                    {on && '✓ '}
                    {o.label} +¥{o.price}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
