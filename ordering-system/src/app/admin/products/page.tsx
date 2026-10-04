'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import type { OptionKey, OptionSoldOut, Product } from '@/lib/types'
import {
  NIGIRI_CATEGORY,
  NO_OPTION_SOLD_OUT,
  OPTION_NAMES,
  OPTION_PRICES,
} from '@/lib/types'

/** 販売中・売り切れの切り替えボタン */
function SoldOutButton({
  soldOut,
  busy,
  onClick,
}: {
  soldOut: boolean
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
        soldOut
          ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
          : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      } disabled:opacity-50`}
    >
      {busy ? '...' : soldOut ? '売り切れ' : '販売中'}
    </button>
  )
}

/**
 * 売り切れ管理
 * 商品とオプション（とろろ昆布・漬け卵黄）の売り切れを切り替える。
 * 毎日0時に、すべて販売中に戻る。
 */
export default function SoldOutAdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [optionSoldOut, setOptionSoldOut] = useState<OptionSoldOut>(NO_OPTION_SOLD_OUT)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [productsRes, optionsRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/options'),
    ])
    if (productsRes.ok) setProducts(await productsRes.json())
    if (optionsRes.ok) setOptionSoldOut(await optionsRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const toggleSoldOut = async (product: Product) => {
    if (updating) return
    setUpdating(product.id)

    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_sold_out: !product.is_sold_out }),
    })

    if (res.ok) {
      const updated = await res.json()
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_sold_out: updated.is_sold_out } : p)),
      )
    } else {
      alert('更新に失敗しました')
    }

    setUpdating(null)
  }

  const toggleOption = async (key: OptionKey) => {
    if (updating) return
    setUpdating(`option-${key}`)
    const res = await fetch(`/api/admin/options/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_sold_out: !optionSoldOut[key] }),
    })
    if (res.ok) {
      const updated: { key: OptionKey; is_sold_out: boolean } = await res.json()
      setOptionSoldOut((prev) => ({ ...prev, [updated.key]: updated.is_sold_out }))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? '更新に失敗しました')
    }
    setUpdating(null)
  }

  /** おにぎりをまとめて売り切れ／販売中にする */
  const bulkNigiri = async (isSoldOut: boolean) => {
    if (updating) return
    const message = isSoldOut
      ? 'おにぎりをすべて「売り切れ」にします。よろしいですか？'
      : 'おにぎりをすべて「販売中」に戻します。よろしいですか？'
    if (!window.confirm(message)) return

    setUpdating('bulk')
    const res = await fetch('/api/admin/products/bulk-sold-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_sold_out: isSoldOut }),
    })
    if (res.ok) {
      await fetchAll()
    } else {
      alert('更新に失敗しました')
    }
    setUpdating(null)
  }

  const nigiri = products.filter((p) => p.category === NIGIRI_CATEGORY)
  const others = products.filter((p) => p.category !== NIGIRI_CATEGORY)

  const ProductRow = ({ product }: { product: Product }) => (
    <div className={`card flex items-center gap-3 p-3 ${product.is_sold_out ? 'opacity-60' : ''}`}>
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-cream-200 flex-shrink-0">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            width={64}
            height={64}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🍙</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base text-brown-800 truncate">{product.name}</p>
        <p className="text-brown-500 text-sm">¥{product.price.toLocaleString()}</p>
      </div>
      <SoldOutButton
        soldOut={product.is_sold_out}
        busy={updating === product.id}
        onClick={() => toggleSoldOut(product)}
      />
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="section-title">売り切れ</h1>
        <p className="text-sm text-brown-400">毎日0時にすべて販売中に戻ります</p>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="text-5xl animate-bounce">🍙</div>
        </div>
      ) : (
        <>
          {/* おにぎり */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-bold text-lg text-brown-800">おにぎり</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => bulkNigiri(true)}
                  disabled={updating !== null}
                  className="px-3 py-2 rounded-xl text-sm font-bold border bg-red-100 text-red-700 border-red-300 hover:bg-red-200 disabled:opacity-50"
                >
                  {updating === 'bulk' ? '更新中...' : 'すべて売り切れにする'}
                </button>
                <button
                  type="button"
                  onClick={() => bulkNigiri(false)}
                  disabled={updating !== null}
                  className="px-3 py-2 rounded-xl text-sm font-bold border bg-green-100 text-green-700 border-green-300 hover:bg-green-200 disabled:opacity-50"
                >
                  すべて販売中に戻す
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {nigiri.map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </div>
          </section>

          {/* オプション */}
          <section className="space-y-3">
            <div>
              <h2 className="font-bold text-lg text-brown-800">オプション</h2>
              <p className="text-xs text-brown-400">
                売り切れにすると、すべてのおにぎりで選べなくなります
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(OPTION_NAMES) as OptionKey[]).map((key) => (
                <div
                  key={key}
                  className={`card flex items-center gap-3 p-3 ${optionSoldOut[key] ? 'opacity-60' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-brown-800">{OPTION_NAMES[key]}</p>
                    <p className="text-brown-500 text-sm">+¥{OPTION_PRICES[key].toLocaleString()}</p>
                  </div>
                  <SoldOutButton
                    soldOut={optionSoldOut[key]}
                    busy={updating === `option-${key}`}
                    onClick={() => toggleOption(key)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* その他の商品 */}
          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-bold text-lg text-brown-800">ランチプレート・サイドほか</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {others.map((product) => (
                  <ProductRow key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
