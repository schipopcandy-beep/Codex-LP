'use client'

import { useState } from 'react'
import type { LunchNigiriUnit, OptionSoldOut, Product } from '@/lib/types'
import Image from 'next/image'
import { calcPlatePrice, getLunchPlateSurcharge, lunchPlateNigiriCount, optionColumns, optionPrice } from '@/lib/types'
import LunchPlateSelector from '@/components/customer/LunchPlateSelector'
import { pickRecommendation } from '@/components/customer/RecommendedItem'

interface Props {
  plate: Product
  products: Product[]
  optionSoldOut?: OptionSoldOut
  onAdd: (units: LunchNigiriUnit[]) => void
  onClose: () => void
}

/**
 * ランチプレートを追加するときに、その場で中のおにぎりを選ぶシート
 * 選び終えたら「このプレートを追加」でカートに入る
 */
export default function LunchPlateSheet({ plate, products, optionSoldOut, onAdd, onClose }: Props) {
  const [units, setUnits] = useState<LunchNigiriUnit[]>([])
  const required = lunchPlateNigiriCount(plate)
  const ready = units.length === required
  const price = calcPlatePrice({ id: 'preview', product: plate, units }, products)

  // メニューの上と同じおすすめを、プレートのおにぎりとしても出す
  const picked = pickRecommendation(products, optionSoldOut)
  const addRecommended = () => {
    if (!picked || units.length >= required) return
    const { options } = picked.recommendation
    setUnits((prev) => [
      ...prev,
      { productId: picked.product.id, tororo: options.tororo, eggYolk: options.eggYolk, large: options.large },
    ])
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-cream-50 rounded-t-3xl max-h-[90dvh] flex flex-col shadow-2xl">
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2 border-b border-cream-300">
          <h2 className="text-lg font-bold text-brown-800">{plate.name}</h2>
          <button onClick={onClose} className="text-brown-400 text-3xl leading-none p-1" aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-3">
          {picked && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-2">
              <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-cream-200">
                {picked.product.image_url && (
                  <Image src={picked.product.image_url} alt={picked.product.name} fill className="object-cover" sizes="56px" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-800">⭐ おすすめ</p>
                <p className="text-sm font-bold text-brown-800 leading-tight">{picked.recommendation.title}</p>
                {(() => {
                  const extra =
                    getLunchPlateSurcharge(picked.product) + optionPrice(optionColumns(picked.recommendation.options))
                  return extra > 0 ? <p className="text-xs text-amber-700 font-bold">+¥{extra}</p> : null
                })()}
              </div>
              <button
                type="button"
                onClick={addRecommended}
                disabled={units.length >= required}
                className="flex-shrink-0 px-3 py-2 rounded-xl bg-brown-600 text-white text-sm font-bold disabled:opacity-40 active:bg-brown-700"
              >
                これにする
              </button>
            </div>
          )}
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
