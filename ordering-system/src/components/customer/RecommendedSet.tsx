'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  /** 枠の見出し（例: 「ランチのおすすめ」「定番セット」） */
  label: string
  title: string
  /** 中身の説明（例: 「焼しゃけ・ツナマヨ・豚汁」） */
  detail?: string
  /** 中身の説明を大きく太い字にする（ランチのおすすめなど、中身がいちばん大事なとき） */
  detailLarge?: boolean
  catchCopy?: string
  imageUrl?: string | null
  price: number
  /** カートに入っている数（数えられないときは省く） */
  quantity?: number
  onAdd: () => void
}

/**
 * メニューの上に出す、組み合わせのおすすめ（ランチプレートのおすすめ・テイクアウトの定番セット）
 * 押すと中身をまとめてカートに入れる
 */
export default function RecommendedSet({ label, title, detail, detailLarge = false, catchCopy, imageUrl, price, quantity = 0, onAdd }: Props) {
  /** 押した直後に「カートに入れました」を出す */
  const [added, setAdded] = useState(false)

  const add = () => {
    onAdd()
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 overflow-hidden">
      <p className="px-3 pt-2 text-sm font-bold text-amber-800">⭐ {label}</p>
      <div className="flex gap-3 p-3 pt-2">
        {/* セット・プレートの写真は横長なので、横長の枠にする */}
        <div className="relative w-32 h-24 flex-shrink-0 self-center rounded-xl overflow-hidden bg-cream-200">
          {imageUrl && (
            <Image src={imageUrl} alt={title} fill className="object-cover" sizes="128px" unoptimized={imageUrl.startsWith('/')} />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="font-bold text-lg text-brown-800 leading-tight">{title}</p>
          {detail && (
            <p className={`mt-0.5 leading-snug ${detailLarge ? 'text-lg font-bold text-amber-800' : 'text-sm text-brown-600'}`}>
              {detail}
            </p>
          )}
          {catchCopy && <p className="text-xs text-brown-500 mt-1 leading-snug">{catchCopy}</p>}
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <p className="text-lg font-bold text-brown-700 tabular-nums">¥{price.toLocaleString()}</p>
            <button
              type="button"
              onClick={add}
              className="relative px-3 py-2 rounded-xl bg-brown-600 text-white text-sm font-bold whitespace-nowrap active:bg-brown-700"
            >
              {added ? 'カートに入れました' : 'カートに入れる'}
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
