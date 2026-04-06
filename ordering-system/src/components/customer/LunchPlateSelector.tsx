'use client'

import type { Product } from '@/lib/types'
import { LUNCH_PLATE_NAME, getLunchPlateSurcharge } from '@/lib/types'

interface Props {
  products: Product[]
  /** productId → 選択数 */
  selections: Map<string, number>
  /** ランチプレート枚数 × 2 */
  totalRequired: number
  onChange: (next: Map<string, number>) => void
}

export default function LunchPlateSelector({ products, selections, totalRequired, onChange }: Props) {
  const nigiri = products.filter((p) => p.name !== LUNCH_PLATE_NAME && !p.is_sold_out)
  const totalSelected = Array.from(selections.values()).reduce((s, v) => s + v, 0)
  const remaining = totalRequired - totalSelected

  const handleDelta = (productId: string, delta: number) => {
    const next = new Map(selections)
    const cur = next.get(productId) ?? 0
    const next_val = cur + delta
    if (next_val <= 0) next.delete(productId)
    else next.set(productId, next_val)
    onChange(next)
  }

  return (
    <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-bold text-brown-800 text-sm">
          おにぎりを {totalRequired} つ選んでください
        </p>
        {remaining > 0 ? (
          <span className="text-xs text-amber-700 font-medium">
            あと {remaining} つ
          </span>
        ) : (
          <span className="text-xs text-matcha-600 font-medium">選択完了 ✓</span>
        )}
      </div>

      <div className="space-y-2">
        {nigiri.map((product) => {
          const surcharge = getLunchPlateSurcharge(product)
          const count = selections.get(product.id) ?? 0
          const canAdd = remaining > 0

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
                  onClick={() => handleDelta(product.id, -1)}
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
                  onClick={() => handleDelta(product.id, 1)}
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
    </div>
  )
}
