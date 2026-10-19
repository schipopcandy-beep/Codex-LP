'use client'

import type { Product } from '@/lib/types'

const TONJIRU_IMAGE_URL =
  'https://wgjfwjourukgtxpkuaup.supabase.co/storage/v1/object/public/product-images/miso-soup.jpg'

/** カートの中に1行で出す豚汁のおすすめ（押すとそのまま追加） */
export default function TonjiruSuggestion({
  product,
  targetLabel,
  onAdd,
}: {
  product: Product
  /** 追加する先の表示（例: "2人目"） */
  targetLabel?: string
  onAdd: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={TONJIRU_IMAGE_URL} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-cream-200" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-brown-800">ご一緒に豚汁はいかがですか？</p>
        <p className="text-xs text-brown-500">おにぎりとの相性抜群です</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex-shrink-0 px-3 py-2 rounded-xl bg-brown-600 text-white text-sm font-bold active:bg-brown-700"
      >
        ＋追加
        <span className="block text-xs font-normal">
          ¥{product.price.toLocaleString()}
          {targetLabel ? `・${targetLabel}` : ''}
        </span>
      </button>
    </div>
  )
}
