'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ProductCard from '@/components/customer/ProductCard'
import DrinkCard from '@/components/customer/DrinkCard'
import Cart from '@/components/customer/Cart'
import type { Product, CartItem, DrinkTiming, LunchNigiriUnit } from '@/lib/types'
import {
  TABLE_NAMES,
  storageUrl,
  LUNCH_PLATE_NAME,
  LUNCH_START_HOUR,
  LUNCH_PLATE_SECOND_NIGIRI_PRICE,
  isLunchTimeNow,
  getLunchPlateSurcharge,
  DRINK_CATEGORY,
} from '@/lib/types'

interface Props {
  tableId: string
  lineUserId?: string | null
  partySize?: number | null
  buildCompleteHref: (orderId: string) => string
}

/** カートのキー: おにぎり系は topping で区別、ドリンクは固定キー */
const cartKey = (productId: string, withTopping: boolean) => `${productId}-${withTopping}`
const drinkKey = (productId: string) => `${productId}-drink`

export default function OrderUI({ tableId, lineUserId, partySize, buildCompleteHref }: Props) {
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cartMap, setCartMap] = useState<Map<string, CartItem>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** ランチプレート1枚ごとのおにぎり選択（1〜2個、とろろ昆布変更含む） */
  const [lunchNigiriPerPlate, setLunchNigiriPerPlate] = useState<LunchNigiriUnit[][]>([])

  const cartItems: CartItem[] = Array.from(cartMap.values())

  const nigiriProducts = products.filter((p) => p.category === 'おにぎり')
  const drinkProducts = products.filter((p) => p.category === DRINK_CATEGORY)
  const lunchPlateProducts = products.filter((p) => p.name === LUNCH_PLATE_NAME)
  const sideProducts = products.filter(
    (p) => p.category !== 'おにぎり' && p.category !== DRINK_CATEGORY && p.name !== LUNCH_PLATE_NAME,
  )
  const tonjiruProduct = products.find((p) => p.name.includes('豚汁'))

  /** ランチタイム判定（11:00〜）。ランチ中はランチプレートのみ注文可 */
  const isLunchTime = isLunchTimeNow()

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
          ...Array.from({ length: lunchPlateCount - prev.length }, () => [] as LunchNigiriUnit[]),
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
  const handleAddDrink = useCallback((product: Product) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = drinkKey(product.id)
      const existing = next.get(key)
      if (existing) {
        next.set(key, { ...existing, quantity: existing.quantity + 1 })
      } else {
        next.set(key, { product, quantity: 1, with_topping: false, timing: undefined })
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

  const handleDrinkTimingChange = useCallback((productId: string, timing: DrinkTiming) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = drinkKey(productId)
      const existing = next.get(key)
      if (existing) next.set(key, { ...existing, timing })
      return next
    })
  }, [])

  const handleLunchNigiriChange = useCallback((index: number, next: LunchNigiriUnit[]) => {
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
      // ランチプレートのおにぎり選択をアイテムに変換（プレート番号を付与）
      // 2個目のおにぎりには +200円（1個 ¥1,300 / 2個 ¥1,500）
      const lunchNigiriItems = lunchNigiriPerPlate.flatMap((units, plateIndex) =>
        units.flatMap((unit, unitIndex) => {
          const product = products.find((p) => p.id === unit.productId)
          if (!product) return []
          return [{
            product_id: unit.productId,
            product_name: product.name,
            quantity: 1,
            unit_price:
              getLunchPlateSurcharge(product) +
              (unitIndex === 1 ? LUNCH_PLATE_SECOND_NIGIRI_PRICE : 0),
            with_topping: unit.tororo,
            timing: null,
            lunch_plate_index: plateIndex,
          }]
        })
      )

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          line_user_id: lineUserId ?? undefined,
          party_size: partySize ?? undefined,
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
        ) : (() => {
          // ─ 各セクションを変数化し、ランチタイム中はドリンクをおにぎりの上に表示する ─
          const lunchPlateSection = lunchPlateProducts.length > 0 && (
            <section key="lunch-plate">
              <h1 className="section-title mb-1 px-1">ランチプレート</h1>
              <p className={`text-xs mb-3 px-1 ${isLunchTime ? 'text-brown-500' : 'text-amber-700 font-medium'}`}>
                {isLunchTime
                  ? `ランチタイム限定（${LUNCH_START_HOUR}:00〜）／おにぎり1個 ¥1,300・2個 ¥1,500`
                  : `ご注文は ${LUNCH_START_HOUR}:00 からです`}
              </p>
              <div className={`grid grid-cols-2 gap-3 ${!isLunchTime ? 'opacity-50 pointer-events-none' : ''}`}>
                {lunchPlateProducts.map((product) => {
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
          )

          const nigiriSection = (
            <section key="nigiri">
              <h2 className="section-title mb-1 px-1">おにぎり</h2>
              {isLunchTime && (
                <p className="text-xs text-amber-700 font-medium mb-3 px-1">
                  ランチタイム（{LUNCH_START_HOUR}:00〜）はランチプレートのみのご注文となります
                </p>
              )}
              <div className={`grid grid-cols-2 gap-3 ${isLunchTime ? 'opacity-50 pointer-events-none' : 'mt-3'}`}>
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
          )

          const sideSection = sideProducts.length > 0 && (
            <section key="side">
              <h2 className="section-title mb-3 px-1">サイド</h2>
              <div className={`grid grid-cols-2 gap-3 ${isLunchTime ? 'opacity-50 pointer-events-none' : ''}`}>
                {sideProducts.map((product) => {
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
          )

          const drinkSection = drinkProducts.length > 0 && (
            <section key="drink">
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
          )

          // ランチ中: プレート → ドリンク → おにぎり → サイド
          // 通常時:   プレート → おにぎり → サイド → ドリンク
          return isLunchTime ? (
            <>
              {lunchPlateSection}
              {drinkSection}
              {nigiriSection}
              {sideSection}
            </>
          ) : (
            <>
              {lunchPlateSection}
              {nigiriSection}
              {sideSection}
              {drinkSection}
            </>
          )
        })()}
      </main>

      <Cart
        items={cartItems}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        allProducts={products}
        lunchNigiriPerPlate={lunchNigiriPerPlate}
        onLunchNigiriChange={handleLunchNigiriChange}
        onDrinkTimingChange={handleDrinkTimingChange}
        onAddItem={handleAdd}
        tonjiruProduct={isLunchTime ? undefined : tonjiruProduct}
      />
    </div>
  )
}
