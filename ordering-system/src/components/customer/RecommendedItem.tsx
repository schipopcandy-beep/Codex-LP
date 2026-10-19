'use client'

import Image from 'next/image'
import type { NigiriOptions, OptionSoldOut, Product } from '@/lib/types'
import { NO_OPTION_SOLD_OUT, isComboSoldOut, optionColumns, optionLabel, optionPrice } from '@/lib/types'

/** おすすめメニュー（商品名とオプションの組み合わせ）。変えるときはここを書き換える */
export const RECOMMENDED = {
  productName: 'おかチー',
  options: { tororo: false, eggYolk: true, large: false } as NigiriOptions,
  catchCopy: '当店一番人気のおかチーに、とろっと濃厚な漬け卵黄をトッピング',
}

interface Props {
  products: Product[]
  optionSoldOut?: OptionSoldOut
  /** カートに入っている数（この組み合わせ） */
  quantity: number
  onAdd: (product: Product, options: NigiriOptions) => void
}

/** メニューの上に出すおすすめ。押すとそのままカートに入る */
export default function RecommendedItem({ products, optionSoldOut = NO_OPTION_SOLD_OUT, quantity, onAdd }: Props) {
  const product = products.find((p) => p.name === RECOMMENDED.productName)
  // 商品がない・売り切れのときは出さない
  if (!product || product.is_sold_out || isComboSoldOut(RECOMMENDED.options, optionSoldOut)) return null

  const columns = optionColumns(RECOMMENDED.options)
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
            {product.name}＋{optionLabel(columns).replace('追加', '')}
          </p>
          <p className="text-xs text-brown-500 mt-1 leading-snug">{RECOMMENDED.catchCopy}</p>
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <p className="text-lg font-bold text-brown-700 tabular-nums">¥{price.toLocaleString()}</p>
            <button
              type="button"
              onClick={() => onAdd(product, RECOMMENDED.options)}
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
