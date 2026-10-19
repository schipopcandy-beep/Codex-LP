'use client'

import { useState } from 'react'
import type { LunchNigiriUnit, OptionSoldOut, Product } from '@/lib/types'
import { calcPlatePrice, lunchPlateNigiriCount } from '@/lib/types'
import LunchPlateSelector from '@/components/customer/LunchPlateSelector'

interface Props {
  plate: Product
  products: Product[]
  optionSoldOut?: OptionSoldOut
  /** 「○人目」の注文に入れるときの表示 */
  dinerLabel?: string
  onAdd: (units: LunchNigiriUnit[]) => void
  onClose: () => void
}

/**
 * ランチプレートを追加するときに、その場で中のおにぎりを選ぶシート
 * 選び終えたら「このプレートを追加」でカートに入る
 */
export default function LunchPlateSheet({ plate, products, optionSoldOut, dinerLabel, onAdd, onClose }: Props) {
  const [units, setUnits] = useState<LunchNigiriUnit[]>([])
  const required = lunchPlateNigiriCount(plate)
  const ready = units.length === required
  const price = calcPlatePrice({ id: 'preview', product: plate, units }, products)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-cream-50 rounded-t-3xl max-h-[90dvh] flex flex-col shadow-2xl">
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2 border-b border-cream-300">
          <div>
            <h2 className="text-lg font-bold text-brown-800">{plate.name}</h2>
            {dinerLabel && <p className="text-sm text-brown-500">{dinerLabel}のご注文</p>}
          </div>
          <button onClick={onClose} className="text-brown-400 text-3xl leading-none p-1" aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-3">
          <LunchPlateSelector
            products={products}
            units={units}
            onChange={setUnits}
            required={required}
            optionSoldOut={optionSoldOut}
          />
        </div>

        <div className="px-4 py-4 border-t border-cream-300 space-y-2">
          <button
            type="button"
            onClick={() => onAdd(units)}
            disabled={!ready}
            className="btn-primary w-full text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ready
              ? `このプレートを追加（¥${price.toLocaleString()}）`
              : `おにぎりをあと${required - units.length}個選んでください`}
          </button>
          <div className="pb-safe" />
        </div>
      </div>
    </div>
  )
}
