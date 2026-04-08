'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ProductCard from '@/components/customer/ProductCard'
import DrinkCard from '@/components/customer/DrinkCard'
import TakeoutCart from '@/components/customer/TakeoutCart'
import type { Product, CartItem } from '@/lib/types'
import { storageUrl, LUNCH_PLATE_NAME, DRINK_CATEGORY, TAKEOUT_TABLE_ID } from '@/lib/types'

interface Props {
  lineUserId?: string | null
}

const cartKey = (productId: string, withTopping: boolean) => `${productId}-${withTopping}`
const drinkKey = (productId: string) => `${productId}-drink`

export default function TakeoutUI({ lineUserId }: Props) {
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cartMap, setCartMap] = useState<Map<string, CartItem>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cartItems: CartItem[] = Array.from(cartMap.values())

  // ランチプレートを除外したメニュー
  const nigiriProducts = products.filter((p) => p.category === 'おにぎり')
  const drinkProducts = products.filter((p) => p.category === DRINK_CATEGORY)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data: Product[]) => {
        // ランチプレートを除外
        setProducts(data.filter((p) => p.name !== LUNCH_PLATE_NAME))
        setLoading(false)
      })
      .catch(() => {
        setError('商品情報の取得に失敗しました')
        setLoading(false)
      })
  }, [])

  /** おにぎり用 */
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
          if (existing.quantity > 1) next.set(key, { ...existing, quantity: existing.quantity - 1 })
          else next.delete(key)
          break
        }
      }
      return next
    })
  }, [])

  /** ドリンク用 */
  const handleAddDrink = useCallback((product: Product) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = drinkKey(product.id)
      const existing = next.get(key)
      if (existing) {
        next.set(key, { ...existing, quantity: existing.quantity + 1 })
      } else {
        next.set(key, { product, quantity: 1, with_topping: false })
      }
      return next
    })
  }, [])

  const handleRemoveDrink = useCallback((product: Product) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = drinkKey(product.id)
      const existing = next.get(key)
      if (existing) {
        if (existing.quantity > 1) next.set(key, { ...existing, quantity: existing.quantity - 1 })
        else next.delete(key)
      }
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (cartItems.length === 0) return
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/takeout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: TAKEOUT_TABLE_ID,
          line_user_id: lineUserId ?? undefined,
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
      router.push(`/takeout/complete?orderId=${encodeURIComponent(order_id)}`)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }, [cartItems, lineUserId, router])

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <p className="text-xl text-brown-600">{error}</p>
      </div>
    )
  }

  return (
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
          <span className="text-sm font-semibold text-brown-600 bg-amber-100 px-3 py-1 rounded-full">
            テイクアウト
          </span>
        </div>
      </header>

      {/* ヒーロー */}
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
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white text-lg font-bold drop-shadow">テイクアウト注文</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-3 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-brown-400 text-lg">メニューを読み込み中...</p>
          </div>
        ) : (
          <>
            {/* おにぎり */}
            <section>
              <h1 className="section-title mb-4 px-1">おにぎり</h1>
              <div className="grid grid-cols-2 gap-3">
                {nigiriProducts.map((product) => {
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
            </section>

            {/* ドリンク */}
            {drinkProducts.length > 0 && (
              <section>
                <h2 className="section-title mb-3 px-1">ドリンク</h2>
                <div className="space-y-2">
                  {drinkProducts.map((product) => (
                    <DrinkCard
                      key={product.id}
                      product={product}
                      quantity={cartMap.get(drinkKey(product.id))?.quantity ?? 0}
                      onAdd={() => handleAddDrink(product)}
                      onRemove={() => handleRemoveDrink(product)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <TakeoutCart
        items={cartItems}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
