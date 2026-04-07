'use client'

import type { Product } from '@/lib/types'

interface Props {
  product: Product
  quantity: number
  onAdd: () => void
  onRemove: () => void
}

export default function DrinkCard({ product, quantity, onAdd, onRemove }: Props) {
  if (product.is_sold_out) {
    return (
      <div className="card px-4 py-3 opacity-60 flex justify-between items-center">
        <p className="font-bold text-brown-800">{product.name}</p>
        <span className="text-sm text-brown-400 bg-cream-200 px-2 py-0.5 rounded-full">売り切れ</span>
      </div>
    )
  }

  return (
    <div className="card px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="font-bold text-base text-brown-800">{product.name}</p>
        <p className="text-sm font-bold text-brown-600">¥{product.price.toLocaleString()}</p>
      </div>

      {quantity === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="btn-primary px-5 py-2 text-sm shrink-0"
        >
          追加する
        </button>
      ) : (
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onRemove}
            className="w-9 h-9 rounded-full bg-cream-200 border border-brown-300 text-brown-700 text-2xl font-bold flex items-center justify-center active:bg-cream-300"
            aria-label="減らす"
          >
            −
          </button>
          <span className="w-6 text-center text-xl font-bold text-brown-800 tabular-nums">{quantity}</span>
          <button
            type="button"
            onClick={onAdd}
            className="w-9 h-9 rounded-full bg-brown-600 text-white text-2xl font-bold flex items-center justify-center active:bg-brown-700"
            aria-label="増やす"
          >
            ＋
          </button>
        </div>
      )}
    </div>
  )
}
