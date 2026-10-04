'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { NigiriOptions, OptionSoldOut, Product } from '@/lib/types'
import {
  EGG_YOLK_CHANGE_LABEL,
  EGG_YOLK_NAME,
  EGG_YOLK_PRICE,
  NO_OPTION_SOLD_OUT,
  TOPPING_CHANGE_LABEL,
  TOPPING_NAME,
  TOPPING_PRICE,
  isLunchPlate,
  isToppingSelectable,
} from '@/lib/types'

interface Props {
  product: Product
  /** オプションの組み合わせごとの注文数（オプションのない商品は常に「なし」で呼ばれる） */
  getQuantity: (options: NigiriOptions) => number
  onAdd: (product: Product, options: NigiriOptions) => void
  onRemove: (product: Product, options: NigiriOptions) => void
  /** オプションの売り切れ状態 */
  optionSoldOut?: OptionSoldOut
}

/** オプションの組み合わせ（内訳の表示順） */
const OPTION_COMBOS: { options: NigiriOptions; label: string }[] = [
  { options: { tororo: false, eggYolk: false }, label: 'そのまま' },
  { options: { tororo: true, eggYolk: false }, label: TOPPING_NAME },
  { options: { tororo: false, eggYolk: true }, label: EGG_YOLK_NAME },
  { options: { tororo: true, eggYolk: true }, label: `${TOPPING_NAME}＋${EGG_YOLK_NAME}` },
]

export default function ProductCard({
  product,
  getQuantity,
  onAdd,
  onRemove,
  optionSoldOut = NO_OPTION_SOLD_OUT,
}: Props) {
  const isSoldOut = product.is_sold_out
  const hasOptions = isToppingSelectable(product) && !isSoldOut
  const tororoAvailable = hasOptions && !optionSoldOut.tororo
  const eggYolkAvailable = hasOptions && !optionSoldOut.egg_yolk

  /** 「追加する」で付けるオプション（追加する前から選べる） */
  const [tororoChecked, setTororoChecked] = useState(false)
  const [eggYolkChecked, setEggYolkChecked] = useState(false)

  /** 増減ボタンの対象。売り切れになったオプションは付けない */
  const target: NigiriOptions = {
    tororo: tororoAvailable && tororoChecked,
    eggYolk: eggYolkAvailable && eggYolkChecked,
  }
  const targetQuantity = getQuantity(target)

  const combos = hasOptions
    ? OPTION_COMBOS.map((c) => ({ ...c, quantity: getQuantity(c.options) }))
    : [{ ...OPTION_COMBOS[0], quantity: getQuantity(OPTION_COMBOS[0].options) }]
  const totalQuantity = combos.reduce((sum, c) => sum + c.quantity, 0)
  const orderedCombos = combos.filter((c) => c.quantity > 0)

  const OptionCheckbox = ({
    checked,
    onChange,
    available,
    label,
    price,
  }: {
    checked: boolean
    onChange: (v: boolean) => void
    available: boolean
    label: string
    price: number
  }) => (
    <label
      className={`flex items-center gap-2 text-sm select-none ${
        available ? 'text-brown-600 cursor-pointer' : 'text-brown-300'
      }`}
    >
      <input
        type="checkbox"
        checked={available && checked}
        disabled={!available}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-brown-600"
      />
      <span>
        {label}
        <span className="text-brown-400 ml-1">(+¥{price})</span>
        {!available && <span className="ml-1 text-xs">売り切れ</span>}
      </span>
    </label>
  )

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
        <p className="font-bold text-base text-brown-800 leading-tight">{product.name}</p>
        {product.description && (
          <p className="text-sm text-brown-500 leading-snug">{product.description}</p>
        )}
        <p className="text-lg font-bold text-brown-600 mt-auto">
          ¥{product.price.toLocaleString()}
          {/* ランチプレートは、選ぶおにぎりによって追加料金がかかるため「〜」を付ける */}
          {isLunchPlate(product) && '~'}
        </p>

        {/* オプション（追加する前から選べる） */}
        {hasOptions && (
          <div className="mt-1 space-y-1">
            <OptionCheckbox
              checked={tororoChecked}
              onChange={setTororoChecked}
              available={tororoAvailable}
              label={TOPPING_CHANGE_LABEL}
              price={TOPPING_PRICE}
            />
            <OptionCheckbox
              checked={eggYolkChecked}
              onChange={setEggYolkChecked}
              available={eggYolkAvailable}
              label={EGG_YOLK_CHANGE_LABEL}
              price={EGG_YOLK_PRICE}
            />
          </div>
        )}

        {/* 数量コントロール（選んでいるオプションの組み合わせごとに数える） */}
        {!isSoldOut && (
          <div className="flex flex-col gap-1 mt-2">
            {targetQuantity === 0 ? (
              <button
                onClick={() => onAdd(product, target)}
                className="w-full btn-primary py-2 text-base"
              >
                追加する
              </button>
            ) : (
              <div className="flex items-center gap-3 w-full justify-center">
                <button
                  onClick={() => onRemove(product, target)}
                  className="w-10 h-10 rounded-full bg-cream-200 border border-brown-300 text-brown-700 text-2xl font-bold flex items-center justify-center active:bg-cream-300"
                  aria-label="減らす"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-brown-800 w-8 text-center tabular-nums">
                  {targetQuantity}
                </span>
                <button
                  onClick={() => onAdd(product, target)}
                  className="w-10 h-10 rounded-full bg-brown-600 text-white text-2xl font-bold flex items-center justify-center active:bg-brown-700"
                  aria-label="増やす"
                >
                  ＋
                </button>
              </div>
            )}

            {/* 複数の組み合わせで注文している場合の内訳 */}
            {orderedCombos.length > 1 && (
              <p className="text-xs text-brown-400 text-center leading-relaxed">
                {orderedCombos.map((c) => `${c.label} ${c.quantity}個`).join('・')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
