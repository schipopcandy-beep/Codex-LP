'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ProductCard from '@/components/customer/ProductCard'
import DrinkCard from '@/components/customer/DrinkCard'
import Cart from '@/components/customer/Cart'
import type { Product, CartItem, DrinkTiming } from '@/lib/types'
import {
  TABLE_NAMES,
  storageUrl,
  LUNCH_PLATE_NAME,
  getLunchPlateSurcharge,
  DRINK_CATEGORY,
} from '@/lib/types'

interface Props {
  tableId: string
  lineUserId?: string | null
  buildCompleteHref: (orderId: string) => string
}

/** カートのキー: おにぎり系は topping で区別、ドリンクは timing で区別 */
const cartKey = (productId: string, withTopping: boolean, timing?: DrinkTiming) =>
  timing ? `${productId}-drink-${timing}` : `${productId}-${withTopping}`

export default function OrderUI({ tableId, lineUserId, buildCompleteHref }: Props) {
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cartMap, setCartMap] = useState<Map<string, CartItem>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** ランチプレート1枚ごとのおにぎり選択: productId → 選択数 */
  const [lunchNigiriPerPlate, setLunchNigiriPerPlate] = useState<Array<Map<string, number>>>([])

  const cartItems: CartItem[] = Array.from(cartMap.values())

  const nigiriProducts = products.filter((p) => p.category === 'おにぎり')
  const drinkProducts = products.filter((p) => p.category === DRINK_CATEGORY)

  /** カート内のランチプレート枚数 */
  const lunchPlateCount = cartItems
    .filter((item) => item.product.name === LUNCH_PLATE_NAME)
    .reduce((sum, item) => sum + item.quantity, 0)

  // ランチプレート枚数に合わせて配列長を同期
  useEffect(() => {
    setLunchNigiriPerPlate((prev) => {
      if (prev.length === lunchPlateCount) return prev
      if (prev.length < lunchPlateCount) {
        return [
          ...prev,
          ...Array.from({ length: lunchPlateCount - prev.length }, () => new Map<string, number>()),
        ]
      }
      return prev.slice(0, lunchPlateCount)
    })
  }, [lunchPlateCount])

  useEffect(() => {
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
  }, [])

  /** おにぎり・ランチプレート用 */
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
  const handleAddDrink = useCallback((product: Product, timing: DrinkTiming) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = cartKey(product.id, false, timing)
      const existing = next.get(key)
      if (existing) {
        next.set(key, { ...existing, quantity: existing.quantity + 1 })
      } else {
        next.set(key, { product, quantity: 1, with_topping: false, timing })
      }
      return next
    })
  }, [])

  const handleRemoveDrink = useCallback((product: Product, timing: DrinkTiming) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = cartKey(product.id, false, timing)
      const existing = next.get(key)
      if (existing) {
        if (existing.quantity > 1) next.set(key, { ...existing, quantity: existing.quantity - 1 })
        else next.delete(key)
      }
      return next
    })
  }, [])

  const handleLunchNigiriChange = useCallback((index: number, next: Map<string, number>) => {
    setLunchNigiriPerPlate((prev) => {
      const arr = [...prev]
      arr[index] = next
      return arr
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (cartItems.length === 0) return
    setIsSubmitting(true)

    try {
      // ランチプレートのおにぎり選択をアイテムに変換
      const lunchNigiriItems = lunchNigiriPerPlate.flatMap((plateMap) =>
        Array.from(plateMap.entries()).flatMap(([productId, count]) => {
          const product = products.find((p) => p.id === productId)
          if (!product || count <= 0) return []
          return [{
            product_id: productId,
            product_name: product.name,
            quantity: count,
            unit_price: getLunchPlateSurcharge(product),
            with_topping: false,
            timing: null,
          }]
        })
      )

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          line_user_id: lineUserId ?? undefined,
          items: [
            ...cartItems.map((item) => ({
              product_id: item.product.id,
              product_name: item.product.name,
              quantity: item.quantity,
              unit_price: item.product.price,
              with_topping: item.with_topping,
              timing: item.timing ?? null,
            })),
            ...lunchNigiriItems,
          ],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? '注文に失敗しました')
      }

      const { order_id } = await res.json()
      router.push(buildCompleteHref(order_id))
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }, [cartItems, lunchNigiriPerPlate, products, tableId, lineUserId, buildCompleteHref, router])

  const tableName = TABLE_NAMES[tableId] ?? tableId

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

      <main className="max-w-2xl mx-auto px-3 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-brown-400 text-lg">メニューを読み込み中...</p>
          </div>
        ) : (
          <>
            {/* おにぎり */}
            <section>
              <h1 className="section-title mb-4 px-1">メニュー</h1>
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
                  {drinkProducts.map((product) => {
                    const counts = new Map<DrinkTiming, number>()
                    for (const timing of ['before', 'with', 'after'] as DrinkTiming[]) {
                      const count = cartMap.get(cartKey(product.id, false, timing))?.quantity ?? 0
                      if (count > 0) counts.set(timing, count)
                    }
                    return (
                      <DrinkCard
                        key={product.id}
                        product={product}
                        counts={counts}
                        onAdd={(timing) => handleAddDrink(product, timing)}
                        onRemove={(timing) => handleRemoveDrink(product, timing)}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {/* ランチプレート等その他 */}
            {products.filter((p) => p.category !== 'おにぎり' && p.category !== DRINK_CATEGORY).length > 0 && (
              <section>
                <h2 className="section-title mb-3 px-1">セット</h2>
                <div className="grid grid-cols-2 gap-3">
                  {products
                    .filter((p) => p.category !== 'おにぎり' && p.category !== DRINK_CATEGORY)
                    .map((product) => {
                      const quantity =
                        (cartMap.get(cartKey(product.id, false))?.quantity ?? 0) +
                        (cartMap.get(cartKey(product.id, true))?.quantity ?? 0)
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          quantity={quantity}
                          withTopping={false}
                          onAdd={handleAdd}
                          onRemove={handleRemove}
                        />
                      )
                    })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <Cart
        items={cartItems}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        allProducts={products}
        lunchNigiriPerPlate={lunchNigiriPerPlate}
        onLunchNigiriChange={handleLunchNigiriChange}
      />
    </div>
  )
}
