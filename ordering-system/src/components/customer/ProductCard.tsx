'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Product } from '@/lib/types'
import { TOPPING_CHANGE_LABEL, TOPPING_PRICE, isToppingSelectable } from '@/lib/types'

interface Props {
  product: Product
  /** とろろ昆布なしの注文数 */
  quantity: number
  /** とろろ昆布に変更した注文数 */
  toppingQuantity?: number
  onAdd: (product: Product, withTopping: boolean) => void
  onRemove: (product: Product, withTopping: boolean) => void
}

export default function ProductCard({
  product,
  quantity,
  toppingQuantity = 0,
  onAdd,
  onRemove,
}: Props) {
  const isSoldOut = product.is_sold_out
  const canTopping = isToppingSelectable(product) && !isSoldOut

  /** 「追加する」で追加する際に、とろろ昆布に変更するか */
  const [withTopping, setWithTopping] = useState(false)

  /** この商品の注文数（とろろ昆布あり・なしの合計） */
  const totalQuantity = quantity + toppingQuantity

  /** 増減ボタンの対象。とろろ昆布ありを選んでいればそちらを増減する */
  const targetTopping = canTopping ? withTopping : false
  const targetQuantity = targetTopping ? toppingQuantity : quantity

  return (
    <div className={`card overflow-hidden flex flex-col ${isSoldOut ? 'opacity-60' : ''}`}>
      {/* 商品画像 */}
      <div className="relative w-full aspect-square bg-cream-200">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-cream-200">
            <span className="text-brown-300 text-sm">no image</span>
          </div>
        )}
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="bg-white text-brown-700 font-bold text-lg px-3 py-1 rounded-full shadow">
              売り切れ
            </span>
          </div>
        )}
        {totalQuantity > 0 && !isSoldOut && (
          <div className="absolute top-2 right-2 min-w-7 h-7 px-2 rounded-full bg-brown-600 text-white text-sm font-bold flex items-center justify-center shadow">
            {totalQuantity}
          </div>
        )}
      </div>

      {/* 商品情報 */}
      <div className="p-3 flex flex-col flex-1 gap-1">
        <p className="font-bold text-base text-brown-800 leading-tight">
          {product.name}
        </p>
        {product.description && (
          <p className="text-sm text-brown-500 leading-snug">
            {product.description}
          </p>
        )}
        <p className="text-lg font-bold text-brown-600 mt-auto">
          ¥{product.price.toLocaleString()}
        </p>

        {/* とろろ昆布への変更（追加する前から選べる） */}
        {canTopping && (
          <label className="flex items-center gap-2 text-sm text-brown-600 cursor-pointer select-none mt-1">
            <input
              type="checkbox"
              checked={withTopping}
              onChange={(e) => setWithTopping(e.target.checked)}
              className="w-4 h-4 accent-brown-600"
            />
            <span>
              {TOPPING_CHANGE_LABEL}
              <span className="text-brown-400 ml-1">(+¥{TOPPING_PRICE})</span>
            </span>
          </label>
        )}

        {/* 数量コントロール（チェックの状態ごとに数える） */}
        {!isSoldOut && (
          <div className="flex flex-col gap-1 mt-2">
            {targetQuantity === 0 ? (
              <button
                onClick={() => onAdd(product, targetTopping)}
                className="w-full btn-primary py-2 text-base"
              >
                追加する
              </button>
            ) : (
              <div className="flex items-center gap-3 w-full justify-center">
                <button
                  onClick={() => onRemove(product, targetTopping)}
                  className="w-10 h-10 rounded-full bg-cream-200 border border-brown-300 text-brown-700 text-2xl font-bold flex items-center justify-center active:bg-cream-300"
                  aria-label="減らす"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-brown-800 w-8 text-center tabular-nums">
                  {targetQuantity}
                </span>
                <button
                  onClick={() => onAdd(product, targetTopping)}
                  className="w-10 h-10 rounded-full bg-brown-600 text-white text-2xl font-bold flex items-center justify-center active:bg-brown-700"
                  aria-label="増やす"
                >
                  ＋
                </button>
              </div>
            )}

            {/* もう一方の状態でも注文がある場合に内訳を示す */}
            {canTopping && quantity > 0 && toppingQuantity > 0 && (
              <p className="text-xs text-brown-400 text-center">
                そのまま {quantity}個・変更 {toppingQuantity}個
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
