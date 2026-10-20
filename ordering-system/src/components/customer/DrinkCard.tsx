'use client'

import type { DrinkTemp, Product } from '@/lib/types'
import { DRINK_TEMP_LABELS, hasDrinkTemp } from '@/lib/types'

interface Props {
  product: Product
  /** 注文数（ホット・アイスを選べるドリンクは温度ごと。それ以外は temp なしで呼ばれる） */
  getQuantity: (temp?: DrinkTemp) => number
  onAdd: (temp?: DrinkTemp) => void
  onRemove: (temp?: DrinkTemp) => void
}

/** 追加ボタン、または ＋− */
function Stepper({ quantity, onAdd, onRemove }: { quantity: number; onAdd: () => void; onRemove: () => void }) {
  if (quantity === 0) {
    return (
      <button type="button" onClick={onAdd} className="btn-primary px-5 py-2 text-sm shrink-0">
        追加する
      </button>
    )
  }
  return (
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
  )
}

export default function DrinkCard({ product, getQuantity, onAdd, onRemove }: Props) {
  if (product.is_sold_out) {
    return (
      <div className="card px-4 py-3 opacity-60 flex justify-between items-center">
        <p className="font-bold text-brown-800">{product.name}</p>
        <span className="text-sm text-brown-400 bg-cream-200 px-2 py-0.5 rounded-full">売り切れ</span>
      </div>
    )
  }

  // 緑茶・ほうじ茶は、ホットとアイスをそれぞれ選べる
  if (hasDrinkTemp(product)) {
    return (
      <div className="card px-4 py-3 space-y-2">
        <div>
          <p className="font-bold text-base text-brown-800">{product.name}</p>
          <p className="text-sm font-bold text-brown-600">¥{product.price.toLocaleString()}</p>
        </div>
        {(['hot', 'ice'] as const).map((temp) => (
          <div key={temp} className="flex items-center justify-between gap-3 pl-1">
            <span
              className={`text-sm font-bold px-3 py-1 rounded-full ${
                temp === 'hot' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
              }`}
            >
              {DRINK_TEMP_LABELS[temp]}
            </span>
            <Stepper quantity={getQuantity(temp)} onAdd={() => onAdd(temp)} onRemove={() => onRemove(temp)} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="card px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="font-bold text-base text-brown-800">{product.name}</p>
        <p className="text-sm font-bold text-brown-600">¥{product.price.toLocaleString()}</p>
      </div>
      <Stepper quantity={getQuantity()} onAdd={() => onAdd()} onRemove={() => onRemove()} />
    </div>
  )
}
