'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import type { Product } from '@/lib/types'

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products')
    if (res.ok) {
      const data = await res.json()
      setProducts(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

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

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title">商品管理</h1>
        <p className="text-sm text-brown-400">売り切れを切り替えられます</p>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="text-5xl animate-bounce">🍙</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((product) => (
            <div
              key={product.id}
              className={`card flex items-center gap-3 p-3 ${
                product.is_sold_out ? 'opacity-60' : ''
              }`}
            >
              {/* サムネイル */}
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
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🍙
                  </div>
                )}
              </div>

              {/* 商品名・価格 */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-brown-800 truncate">
                  {product.name}
                </p>
                <p className="text-brown-500 text-sm">
                  ¥{product.price.toLocaleString()}
                </p>
                {product.topping_available && (
                  <p className="text-xs text-brown-400">トッピング可</p>
                )}
              </div>

              {/* 売り切れトグル */}
              <button
                onClick={() => toggleSoldOut(product)}
                disabled={updating === product.id}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
                  product.is_sold_out
                    ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                } disabled:opacity-50`}
              >
                {updating === product.id
                  ? '...'
                  : product.is_sold_out
                  ? '売り切れ'
                  : '販売中'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
