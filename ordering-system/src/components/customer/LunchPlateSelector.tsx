'use client'

import type { Product, LunchNigiriUnit } from '@/lib/types'
import {
  getLunchPlateSurcharge,
  LUNCH_PLATE_SECOND_NIGIRI_PRICE,
  TOPPING_PRICE,
  TOPPING_CART_LABEL,
} from '@/lib/types'

interface Props {
  products: Product[]
  /** このプレートで選択中のおにぎり（最大2個） */
  units: LunchNigiriUnit[]
  onChange: (next: LunchNigiriUnit[]) => void
  /** 複数枚時のラベル（例: "1枚目"） */
  plateLabel?: string
}

const MAX_UNITS = 2

export default function LunchPlateSelector({ products, units, onChange, plateLabel }: Props) {
  const nigiri = products.filter((p) => p.category === 'おにぎり' && !p.is_sold_out)
  const totalSelected = units.length
  const canAdd = totalSelected < MAX_UNITS

  const countOf = (productId: string) =>
    units.filter((u) => u.productId === productId).length

  const addUnit = (productId: string) => {
    if (!canAdd) return
    onChange([...units, { productId, tororo: false }])
  }

  const removeUnit = (productId: string) => {
    // 同じ商品の最後の1個を取り除く
    const idx = [...units].reverse().findIndex((u) => u.productId === productId)
    if (idx === -1) return
    const realIdx = units.length - 1 - idx
    onChange(units.filter((_, i) => i !== realIdx))
  }

  const toggleTororo = (index: number) => {
    onChange(units.map((u, i) => (i === index ? { ...u, tororo: !u.tororo } : u)))
  }

  return (
    <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-brown-800 text-sm">
          {plateLabel ? `${plateLabel}：` : ''}おにぎりを選んでください（1〜2個）
        </p>
        {totalSelected === 0 ? (
          <span className="text-xs text-amber-700 font-medium">1個以上選択</span>
        ) : (
          <span className="text-xs text-matcha-600 font-medium">選択中 {totalSelected}個 ✓</span>
        )}
      </div>
      <p className="text-xs text-brown-500 -mt-1">
        おにぎり1個 ¥1,300／2個 ¥1,500（2個目 +¥{LUNCH_PLATE_SECOND_NIGIRI_PRICE}）
      </p>

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

      {/* 選択したおにぎりごとの とろろ昆布変更 */}
      {units.length > 0 && (
        <div className="border-t border-amber-200 pt-2 space-y-1.5">
          {units.map((unit, i) => {
            const product = products.find((p) => p.id === unit.productId)
            if (!product) return null
            return (
              <label
                key={`${unit.productId}-${i}`}
                className="flex items-center justify-between gap-2 cursor-pointer select-none"
              >
                <span className="text-sm text-brown-700">
                  {units.length > 1 ? `${i + 1}個目：` : ''}{product.name}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-brown-600 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={unit.tororo}
                    onChange={() => toggleTororo(i)}
                    className="w-4 h-4 accent-brown-600"
                  />
                  {TOPPING_CART_LABEL}（+¥{TOPPING_PRICE}）
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
