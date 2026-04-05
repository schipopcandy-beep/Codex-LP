'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ProductCard from '@/components/customer/ProductCard'
import Cart from '@/components/customer/Cart'
import OrderAccessGuard from '@/components/customer/OrderAccessGuard'
import type { Product, CartItem } from '@/lib/types'
import { TABLE_NAMES, storageUrl } from '@/lib/types'

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

  const lineUserIdRef = useRef<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cartMap, setCartMap] = useState<Map<string, CartItem>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cartKey = (productId: string, withTopping: boolean) =>
    `${productId}-${withTopping}`

  const cartItems: CartItem[] = Array.from(cartMap.values())

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
        next.set(key, { ...existing, quantity: existing.quantity + 1, with_topping: withTopping })
      } else {
        const oppositeKey = cartKey(product.id, !withTopping)
        if (next.has(oppositeKey)) next.delete(oppositeKey)
        next.set(key, { product, quantity: 1, with_topping: withTopping })
      }
      return next
    })
  }, [])

  const handleRemove = useCallback((product: Product) => {
    setCartMap((prev) => {
      const next = new Map(prev)
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
          line_user_id: lineUserIdRef.current ?? undefined,
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
        <p className="text-xl text-brown-600">{error}</p>
      </div>
    )
  }

  const orderUI = (
    <div className="min-h-dvh bg-cream-50 pb-28">
      {/* ヘッダー */}
      <header className="sticky top-0 z-30 bg-cream-50/95 backdrop-blur border-b border-cream-300">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
          <Image
            src={storageUrl('logo.png')}
            alt="織はや"
            width={120}
            height={48}
            className="object-contain h-10 w-auto"
          />
          <p className="text-sm text-brown-400">{tableName}</p>
        </div>
      </header>

      {/* 店内写真ヒーロー */}
      <div className="relative w-full h-36 overflow-hidden">
        <Image
          src={storageUrl('interior.jpg')}
          alt="店内の様子"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-brown-900/30" />
      </div>

      <main className="max-w-2xl mx-auto px-3 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-brown-400 text-lg">メニューを読み込み中...</p>
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

  return (
    <OrderAccessGuard
      tableId={tableId}
      onUserIdReady={(uid) => { lineUserIdRef.current = uid }}
    >
      {orderUI}
    </OrderAccessGuard>
  )
}
