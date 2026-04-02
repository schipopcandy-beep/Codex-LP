'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import ProductCard from '@/components/customer/ProductCard'
import Cart from '@/components/customer/Cart'
import type { Product, CartItem } from '@/lib/types'
import { TABLE_NAMES } from '@/lib/types'

const VALID_TABLE_IDS = [
  'table-1', 'table-2', 'table-3', 'table-4',
  'counter-1', 'counter-2', 'counter-3', 'counter-4',
]

interface Props {
  params: Promise<{ tableId: string }>
}

export default function TableOrderPage({ params }: Props) {
  const { tableId } = use(params)
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // カート: { [productId-topping]: CartItem }
  const [cartMap, setCartMap] = useState<Map<string, CartItem>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cartKey = (productId: string, withTopping: boolean) =>
    `${productId}-${withTopping}`

  const cartItems: CartItem[] = Array.from(cartMap.values())

  // 商品取得
  useEffect(() => {
    if (!VALID_TABLE_IDS.includes(tableId)) {
      setError('無効な席IDです')
      setLoading(false)
      return
    }

    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        setProducts(data)
        setLoading(false)
      })
      .catch(() => {
        setError('商品情報の取得に失敗しました')
        setLoading(false)
      })
  }, [tableId])

  const handleAdd = useCallback((product: Product, withTopping: boolean) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = cartKey(product.id, withTopping)
      const existing = next.get(key)

      if (existing) {
        // トッピング変更の場合は既存アイテムを更新
        next.set(key, { ...existing, quantity: existing.quantity + 1, with_topping: withTopping })
      } else {
        // 同じ商品の逆トッピングがあれば削除して新規追加
        const oppositeKey = cartKey(product.id, !withTopping)
        if (next.has(oppositeKey)) {
          next.delete(oppositeKey)
        }
        next.set(key, { product, quantity: 1, with_topping: withTopping })
      }
      return next
    })
  }, [])

  const handleRemove = useCallback((product: Product) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      // トッピングあり・なし両方を探す
      for (const withTopping of [true, false]) {
        const key = cartKey(product.id, withTopping)
        const existing = next.get(key)
        if (existing) {
          if (existing.quantity > 1) {
            next.set(key, { ...existing, quantity: existing.quantity - 1 })
          } else {
            next.delete(key)
          }
          break
        }
      }
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (cartItems.length === 0) return
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          items: cartItems.map((item) => ({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            unit_price: item.product.price,
            with_topping: item.with_topping,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? '注文に失敗しました')
      }

      const { order_id } = await res.json()
      router.push(`/table/${tableId}/complete?orderId=${order_id}`)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }, [cartItems, tableId, router])

  const tableName = TABLE_NAMES[tableId] ?? tableId

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-5xl mb-4">🍙</p>
          <p className="text-xl text-brown-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-cream-50 pb-28">
      {/* ヘッダー */}
      <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-cream-300">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-serif text-2xl font-bold text-brown-700">🍙 おにぎり</p>
            <p className="text-sm text-brown-400">{tableName}</p>
          </div>
          <p className="text-sm text-brown-400">
            ご注文はカートからどうぞ
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="text-5xl animate-bounce">🍙</div>
              <p className="text-brown-500">メニューを読み込み中...</p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="section-title mb-4 px-1">メニュー</h1>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => {
                const withTopping = cartMap.get(cartKey(product.id, true))?.with_topping ?? false
                const quantity =
                  (cartMap.get(cartKey(product.id, false))?.quantity ?? 0) +
                  (cartMap.get(cartKey(product.id, true))?.quantity ?? 0)

                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={quantity}
                    withTopping={withTopping}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                  />
                )
              })}
            </div>
          </>
        )}
      </main>

      <Cart
        items={cartItems}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
