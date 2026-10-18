'use client'

import { useState } from 'react'
import type { CartItem, NigiriOptions, OptionSoldOut, Product } from '@/lib/types'
import ToppingSuggestions, { hasToppingSuggestions } from '@/components/customer/ToppingSuggestions'

const TONJIRU_IMAGE_URL =
  'https://wgjfwjourukgtxpkuaup.supabase.co/storage/v1/object/public/product-images/miso-soup.jpg'

interface Props {
  items: CartItem[]
  /** 豚汁をおすすめするときに渡す（カートにすでにある場合などは渡さない） */
  tonjiruProduct?: Product
  onAddTonjiru?: (product: Product) => void
  optionSoldOut?: OptionSoldOut
  onOptionsChange?: (item: CartItem, options: NigiriOptions) => void
  /** 「次へ」を押した（豚汁を選んでいればカートに入れた後） */
  onNext: () => void
  onClose: () => void
}

/** おすすめのポップアップを出すか（豚汁かトッピングのどちらかがあれば出す） */
export function shouldShowRecommend(
  items: CartItem[],
  tonjiruProduct: Product | undefined,
  optionSoldOut: OptionSoldOut | undefined,
  canChangeOptions: boolean,
): boolean {
  return !!tonjiruProduct || (canChangeOptions && hasToppingSuggestions(items, optionSoldOut))
}

/**
 * カートを開く前のおすすめ
 * - 豚汁（カートにないとき）: ボタンで選ぶ
 * - おにぎりのトッピング: おにぎりごとにボタンで付け外し
 * 選び終えたら、下の「注文内容の確認へ」で次に進む
 */
export default function RecommendPopup({
  items,
  tonjiruProduct,
  onAddTonjiru,
  optionSoldOut,
  onOptionsChange,
  onNext,
  onClose,
}: Props) {
  const [tonjiruChosen, setTonjiruChosen] = useState(false)
  const showToppings = !!onOptionsChange && hasToppingSuggestions(items, optionSoldOut)

  const next = () => {
    if (tonjiruChosen && tonjiruProduct && onAddTonjiru) onAddTonjiru(tonjiruProduct)
    onNext()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-cream-50 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 max-h-[90dvh] overflow-y-auto">
        {tonjiruProduct && (
          <div className="text-center space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={TONJIRU_IMAGE_URL} alt="豚汁" className="w-full h-40 object-cover rounded-xl" />
            <h3 className="text-xl font-bold text-brown-800">ご一緒に豚汁はいかがですか？</h3>
            <p className="text-sm text-brown-500">おにぎりとの相性抜群です。</p>
            <button
              type="button"
              onClick={() => setTonjiruChosen((v) => !v)}
              aria-pressed={tonjiruChosen}
              className={`w-full py-3 rounded-xl text-base font-bold border-2 ${
                tonjiruChosen
                  ? 'bg-brown-600 border-brown-600 text-white'
                  : 'bg-white border-brown-400 text-brown-700 active:bg-cream-200'
              }`}
            >
              {tonjiruChosen ? '✓ 豚汁を追加する' : '豚汁を追加する'}（¥{tonjiruProduct.price.toLocaleString()}）
            </button>
          </div>
        )}

        {showToppings && onOptionsChange && (
          <ToppingSuggestions
            items={items}
            optionSoldOut={optionSoldOut}
            onOptionsChange={onOptionsChange}
            divider={!!tonjiruProduct}
          />
        )}

        <button type="button" onClick={next} className="btn-primary w-full py-3 text-base">
          注文内容の確認へ
        </button>
      </div>
    </div>
  )
}
