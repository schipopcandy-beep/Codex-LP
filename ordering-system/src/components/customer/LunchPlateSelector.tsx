'use client'

import type { Product, LunchNigiriUnit, OptionSoldOut } from '@/lib/types'
import {
  getLunchPlateSurcharge,
  isToppingSelectable,
  NO_OPTION_SOLD_OUT,
  TOPPING_PRICE,
  TOPPING_CART_LABEL,
  EGG_YOLK_PRICE,
  EGG_YOLK_CART_LABEL,
} from '@/lib/types'

interface Props {
  products: Product[]
  /** このプレートで選択中のおにぎり */
  units: LunchNigiriUnit[]
  onChange: (next: LunchNigiriUnit[]) => void
  /** このプレートで選ぶおにぎりの個数 */
  required: number
  /** 複数枚時のラベル（例: "1枚目"） */
  plateLabel?: string
  /** とろろ昆布・漬け卵黄の売り切れ状態 */
  optionSoldOut?: OptionSoldOut
}

export default function LunchPlateSelector({
  products,
  units,
  onChange,
  required,
  plateLabel,
  optionSoldOut = NO_OPTION_SOLD_OUT,
}: Props) {
  const nigiri = products.filter((p) => p.category === 'おにぎり' && !p.is_sold_out)
  const totalSelected = units.length
  const canAdd = totalSelected < required

  const countOf = (productId: string) =>
    units.filter((u) => u.productId === productId).length

  const addUnit = (productId: string) => {
    if (!canAdd) return
    onChange([...units, { productId, tororo: false, eggYolk: false }])
  }

  const removeUnit = (productId: string) => {
    // 同じ商品の最後の1個を取り除く
    const idx = [...units].reverse().findIndex((u) => u.productId === productId)
    if (idx === -1) return
    const realIdx = units.length - 1 - idx
    onChange(units.filter((_, i) => i !== realIdx))
  }

  const toggleOption = (index: number, key: 'tororo' | 'eggYolk') => {
    onChange(units.map((u, i) => (i === index ? { ...u, [key]: !u[key] } : u)))
  }

  return (
    <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-brown-800 text-sm">
          {plateLabel ? `${plateLabel}：` : ''}おにぎりを{required}個選んでください
        </p>
        {totalSelected < required ? (
          <span className="text-xs text-amber-700 font-medium">
            あと{required - totalSelected}個
          </span>
        ) : (
          <span className="text-xs text-matcha-600 font-medium">選択済み ✓</span>
        )}
      </div>

      <div className="space-y-2">
        {nigiri.map((product) => {
          const surcharge = getLunchPlateSurcharge(product)
          const count = countOf(product.id)

          return (
            <div key={product.id} className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-brown-800 leading-tight">{product.name}</span>
                {surcharge > 0 && (
                  <span className="ml-1.5 text-xs text-amber-600 whitespace-nowrap">
                    +¥{surcharge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => removeUnit(product.id)}
                  disabled={count === 0}
                  className="w-7 h-7 rounded-full border border-brown-400 text-brown-600 font-bold text-lg leading-none flex items-center justify-center disabled:opacity-30 active:bg-brown-100"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-bold text-brown-700 tabular-nums">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => addUnit(product.id)}
                  disabled={!canAdd}
                  className="w-7 h-7 rounded-full border border-brown-400 text-brown-600 font-bold text-lg leading-none flex items-center justify-center disabled:opacity-30 active:bg-brown-100"
                >
                  ＋
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 選択したおにぎりごとのオプション（単品と同じく全おにぎりが対象） */}
      {units.some((u) => {
        const product = products.find((p) => p.id === u.productId)
        return product != null && isToppingSelectable(product)
      }) && (
        <div className="border-t border-amber-200 pt-2 space-y-1.5">
          {units.map((unit, i) => {
            const product = products.find((p) => p.id === unit.productId)
            if (!product || !isToppingSelectable(product)) return null
            const optionRows = [
              { key: 'tororo' as const, label: TOPPING_CART_LABEL, price: TOPPING_PRICE, soldOut: optionSoldOut.tororo },
              { key: 'eggYolk' as const, label: EGG_YOLK_CART_LABEL, price: EGG_YOLK_PRICE, soldOut: optionSoldOut.egg_yolk },
            ]
            return (
              <div key={`${unit.productId}-${i}`} className="flex items-start justify-between gap-2">
                <span className="text-sm text-brown-700 pt-0.5">
                  {units.length > 1 ? `${i + 1}個目：` : ''}{product.name}
                </span>
                <div className="flex flex-col items-end gap-1">
                  {optionRows.map((o) => {
                    // 売り切れのオプションは選べない（選択済みでも外した扱いで表示する）
                    const checked = !o.soldOut && !!unit[o.key]
                    return (
                      <label
                        key={o.key}
                        className={`flex items-center gap-1.5 text-xs whitespace-nowrap select-none ${
                          o.soldOut ? 'text-brown-300' : 'text-brown-600 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={o.soldOut}
                          onChange={() => toggleOption(i, o.key)}
                          className="w-4 h-4 accent-brown-600"
                        />
                        {o.label}（+¥{o.price}）{o.soldOut && ' 売り切れ'}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
