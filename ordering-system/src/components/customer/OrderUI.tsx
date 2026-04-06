'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ProductCard from '@/components/customer/ProductCard'
import Cart from '@/components/customer/Cart'
import type { Product, CartItem } from '@/lib/types'
import { TABLE_NAMES, storageUrl, LUNCH_PLATE_NAME, getLunchPlateSurcharge } from '@/lib/types'

interface Props {
  tableId: string
  lineUserId?: string | null
  /** 注文完了後の遷移先URLを生成する関数 */
  buildCompleteHref: (orderId: string) => string
}

const cartKey = (productId: string, withTopping: boolean) =>
  `${productId}-${withTopping}`

export default function OrderUI({ tableId, lineUserId, buildCompleteHref }: Props) {
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cartMap, setCartMap] = useState<Map<string, CartItem>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** ランチプレートのおにぎり選択: productId → 選択数 */
  const [lunchNigiri, setLunchNigiri] = useState<Map<string, number>>(new Map())

  const cartItems: CartItem[] = Array.from(cartMap.values())

  /** カート内のランチプレート枚数 */
  const lunchPlateCount = cartItems
    .filter((item) => item.product.name === LUNCH_PLATE_NAME)
    .reduce((sum, item) => sum + item.quantity, 0)

  // ランチプレート枚数が減ったとき、選択数をトリム
  useEffect(() => {
    const required = lunchPlateCount * 2
    const selected = Array.from(lunchNigiri.values()).reduce((s, v) => s + v, 0)
    if (selected <= required) return

    // 超過分を末尾のエントリから削除
    let over = selected - required
    const next = new Map(lunchNigiri)
    for (const [id, cnt] of [...next.entries()].reverse()) {
      if (over <= 0) break
      const remove = Math.min(cnt, over)
      const newCnt = cnt - remove
      if (newCnt <= 0) next.delete(id)
      else next.set(id, newCnt)
      over -= remove
    }
    setLunchNigiri(next)
  }, [lunchPlateCount]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // ランチプレートのおにぎり選択をオーダーアイテムに変換
      const lunchNigiriItems = Array.from(lunchNigiri.entries()).flatMap(([productId, count]) => {
        const product = products.find((p) => p.id === productId)
        if (!product || count <= 0) return []
        const surcharge = getLunchPlateSurcharge(product)
        return [{
          product_id: productId,
          product_name: product.name,
          quantity: count,
          unit_price: surcharge,
          with_topping: false,
        }]
      })

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
  }, [cartItems, lunchNigiri, products, tableId, lineUserId, buildCompleteHref, router])

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
        allProducts={products}
        lunchPlateCount={lunchPlateCount}
        lunchNigiri={lunchNigiri}
        onLunchNigiriChange={setLunchNigiri}
      />
    </div>
  )
}
