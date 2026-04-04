'use client'

import Image from 'next/image'
import type { Product } from '@/lib/types'
import { TOPPING_NAME, TOPPING_PRICE } from '@/lib/types'

interface Props {
  product: Product
  quantity: number
  withTopping: boolean
  onAdd: (product: Product, withTopping: boolean) => void
  onRemove: (product: Product) => void
}

export default function ProductCard({ product, quantity, withTopping, onAdd, onRemove }: Props) {
  const isSoldOut = product.is_sold_out

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

        {/* トッピング */}
        {product.topping_available && !isSoldOut && (
          <label className="flex items-center gap-2 text-sm text-brown-600 cursor-pointer select-none mt-1">
            <input
              type="checkbox"
              checked={withTopping}
              onChange={(e) => onAdd(product, e.target.checked)}
              className="w-4 h-4 accent-brown-600"
              disabled={quantity === 0}
            />
            <span>
              +{TOPPING_NAME}
              <span className="text-brown-400 ml-1">(+¥{TOPPING_PRICE})</span>
            </span>
          </label>
        )}

        {/* 数量コントロール */}
        {!isSoldOut && (
          <div className="flex items-center justify-between mt-2">
            {quantity === 0 ? (
              <button
                onClick={() => onAdd(product, withTopping)}
                className="w-full btn-primary py-2 text-base"
              >
                追加する
              </button>
            ) : (
              <div className="flex items-center gap-3 w-full justify-center">
                <button
                  onClick={() => onRemove(product)}
                  className="w-10 h-10 rounded-full bg-cream-200 border border-brown-300 text-brown-700 text-2xl font-bold flex items-center justify-center active:bg-cream-300"
                  aria-label="減らす"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-brown-800 w-8 text-center tabular-nums">
                  {quantity}
                </span>
                <button
                  onClick={() => onAdd(product, withTopping)}
                  className="w-10 h-10 rounded-full bg-brown-600 text-white text-2xl font-bold flex items-center justify-center active:bg-brown-700"
                  aria-label="増やす"
                >
                  ＋
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
