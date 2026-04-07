'use client'

import type { Product, DrinkTiming } from '@/lib/types'
import { DRINK_TIMING_LABELS } from '@/lib/types'

const TIMINGS: DrinkTiming[] = ['before', 'with', 'after']

interface Props {
  product: Product
  /** timing → 選択数 */
  counts: Map<DrinkTiming, number>
  onAdd: (timing: DrinkTiming) => void
  onRemove: (timing: DrinkTiming) => void
}

export default function DrinkCard({ product, counts, onAdd, onRemove }: Props) {
  if (product.is_sold_out) {
    return (
      <div className="card px-4 py-3 opacity-60">
        <div className="flex justify-between items-center">
          <p className="font-bold text-brown-800">{product.name}</p>
          <span className="text-sm text-brown-400 bg-cream-200 px-2 py-0.5 rounded-full">売り切れ</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card px-4 py-3 space-y-2">
      <div className="flex justify-between items-baseline">
        <p className="font-bold text-base text-brown-800">{product.name}</p>
        <p className="font-bold text-brown-600 tabular-nums">¥{product.price.toLocaleString()}</p>
      </div>

      <div className="space-y-1.5">
        {TIMINGS.map((timing) => {
          const count = counts.get(timing) ?? 0
          return (
            <div key={timing} className="flex items-center justify-between">
              <span className="text-sm text-brown-600 w-10">{DRINK_TIMING_LABELS[timing]}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onRemove(timing)}
                  disabled={count === 0}
                  className="w-8 h-8 rounded-full bg-cream-200 border border-brown-300 text-brown-700 text-xl font-bold flex items-center justify-center disabled:opacity-30 active:bg-cream-300"
                  aria-label="減らす"
                >
                  −
                </button>
                <span className="w-5 text-center text-lg font-bold text-brown-800 tabular-nums">{count}</span>
                <button
                  type="button"
                  onClick={() => onAdd(timing)}
                  className="w-8 h-8 rounded-full bg-brown-600 text-white text-xl font-bold flex items-center justify-center active:bg-brown-700"
                  aria-label="増やす"
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
