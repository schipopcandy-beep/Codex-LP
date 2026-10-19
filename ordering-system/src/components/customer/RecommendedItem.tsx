'use client'

import Image from 'next/image'
import type { NigiriOptions, OptionSoldOut, Product } from '@/lib/types'
import { NO_OPTION_SOLD_OUT, isComboSoldOut, optionColumns, optionPrice } from '@/lib/types'

/**
 * おすすめメニュー（上から順に、売り切れでない最初の1つを出す）。変えるときはここを書き換える
 * 例: 漬け卵黄が売り切れたら、大満足120%のほうをおすすめする
 */
export const RECOMMENDATIONS: {
  productName: string
  options: NigiriOptions
  title: string
  /** 紹介文（空なら出さない） */
  catchCopy?: string
}[] = [
  {
    productName: 'おかチー',
    options: { tororo: false, eggYolk: true, large: false },
    title: 'おかチー＋漬け卵黄',
    catchCopy: '当店一番人気のおかチーに、とろっと濃厚な漬け卵黄をトッピング',
  },
  {
    productName: 'おかチー',
    options: { tororo: false, eggYolk: false, large: true },
    title: 'おかチー＋大満足120%おにぎり',
  },
]

interface Props {
  products: Product[]
  optionSoldOut?: OptionSoldOut
  /** カートに入っている数（商品とオプションの組み合わせごと） */
  getQuantity: (product: Product, options: NigiriOptions) => number
  onAdd: (product: Product, options: NigiriOptions) => void
}

/** 商品があって、商品もオプションも売り切れでない最初のおすすめ（どれもなければ null） */
export function pickRecommendation(products: Product[], optionSoldOut: OptionSoldOut = NO_OPTION_SOLD_OUT) {
  for (const r of RECOMMENDATIONS) {
    const product = products.find((p) => p.name === r.productName)
    if (product && !product.is_sold_out && !isComboSoldOut(r.options, optionSoldOut)) {
      return { recommendation: r, product }
    }
  }
  return null
}

/** メニューの上に出すおすすめ。押すとそのままカートに入る */
export default function RecommendedItem({ products, optionSoldOut = NO_OPTION_SOLD_OUT, getQuantity, onAdd }: Props) {
  const picked = pickRecommendation(products, optionSoldOut)
  if (!picked) return null
  const { recommendation, product } = picked
  const quantity = getQuantity(product, recommendation.options)

  const columns = optionColumns(recommendation.options)
  const price = product.price + optionPrice(columns)

  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 overflow-hidden">
      <p className="px-3 pt-2 text-sm font-bold text-amber-800">⭐ おすすめ</p>
      <div className="flex gap-3 p-3 pt-2">
        <div className="relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-cream-200">
          {product.image_url && (
            <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="112px" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="font-bold text-lg text-brown-800 leading-tight">
            {recommendation.title}
          </p>
          {recommendation.catchCopy && (
            <p className="text-xs text-brown-500 mt-1 leading-snug">{recommendation.catchCopy}</p>
          )}
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <p className="text-lg font-bold text-brown-700 tabular-nums">¥{price.toLocaleString()}</p>
            <button
              type="button"
              onClick={() => onAdd(product, recommendation.options)}
              className="relative px-3 py-2 rounded-xl bg-brown-600 text-white text-sm font-bold whitespace-nowrap active:bg-brown-700"
            >
              カートに入れる
              {quantity > 0 && (
                <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                  {quantity}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
