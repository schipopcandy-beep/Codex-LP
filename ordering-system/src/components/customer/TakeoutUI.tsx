'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ProductCard from '@/components/customer/ProductCard'
import TakeoutCart from '@/components/customer/TakeoutCart'
import RecommendedItem from '@/components/customer/RecommendedItem'
import LunchPlateSheet from '@/components/customer/LunchPlateSheet'
import type { Product, CartItem, CartPlate, LunchNigiriUnit, NigiriOptions, OptionSoldOut } from '@/lib/types'
import { addDays, todayJST } from '@/lib/business-hours'
import {
  storageUrl,
  isLunchPlate,
  isBento,
  BENTO_LEAD_DAYS,
  DRINK_CATEGORY,
  TAKEOUT_TABLE_ID,
  NO_OPTIONS,
  NO_OPTION_SOLD_OUT,
  isHiddenFromMenu,
  optionsOfItem,
} from '@/lib/types'

interface Props {
  lineUserId?: string | null
  /** LINEの表示名。注文者名として管理画面にだけ表示する（お客様の画面には出さない） */
  lineDisplayName?: string | null
  /** 席から来た場合の seat パラメータ（例: t1） */
  seat?: string
  /** 席から来た場合の卓ID。指定時はその卓の伝票にお持ち帰り分として加える */
  seatTableId?: string | null
}

/** カートのキー。オプション（とろろ昆布・漬け卵黄）の組み合わせごとに別の行として持つ */
const cartKey = (productId: string, options: NigiriOptions) =>
  `${productId}-${options.tororo}${options.eggYolk ? '-egg' : ''}${options.large ? '-large' : ''}`

const optionsOf = (item: CartItem): NigiriOptions => optionsOfItem(item)

export default function TakeoutUI({ lineUserId, lineDisplayName, seat, seatTableId }: Props) {
  /** 席からのお持ち帰り注文か（受取日時の指定もLINE通知も行わない） */
  const isSeatOrder = !!seatTableId
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cartMap, setCartMap] = useState<Map<string, CartItem>>(new Map())
  /** とろろ昆布・漬け卵黄の売り切れ状態 */
  const [optionSoldOut, setOptionSoldOut] = useState<OptionSoldOut>(NO_OPTION_SOLD_OUT)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pickupDate, setPickupDate] = useState<string | null>(null)
  const [pickupTime, setPickupTime] = useState<string | null>(null)
  /** カートのお弁当（中のおにぎりを選んだもの） */
  const [bentos, setBentos] = useState<CartPlate[]>([])
  /** おにぎりを選んでいるお弁当 */
  const [bentoSheet, setBentoSheet] = useState<Product | null>(null)
  /**
   * 今日の分が売り切れの商品（販売休止中のものは除く）
   * テイクアウト予約では、明日以降の受け取りなら注文できる（夜中に売り切れが戻るため）
   */
  const [soldOutToday, setSoldOutToday] = useState<Set<string>>(new Set())

  const handlePickupSelect = useCallback((date: string, time: string) => {
    setPickupDate(date)
    setPickupTime(time)
  }, [])

  const cartItems: CartItem[] = Array.from(cartMap.values())

  // ランチプレートを除外したメニュー（ドリンクはテイクアウト対象外）
  const nigiriProducts = products.filter((p) => p.category === 'おにぎり')
  const sideProducts = products.filter(
    (p) => p.category !== 'おにぎり' && p.category !== DRINK_CATEGORY && !isHiddenFromMenu(p) && !isBento(p),
  )
  // お弁当は2日前までの予約のため、テイクアウト予約だけで扱う（席からのお持ち帰りでは出さない）
  const bentoProducts = isSeatOrder ? [] : products.filter(isBento)
  /** 今日の分が売り切れの商品がカートにあるか（お弁当の中のおにぎりも含む） */
  const hasSoldOutToday =
    cartItems.some((item) => soldOutToday.has(item.product.id)) ||
    bentos.some((b) => soldOutToday.has(b.product.id) || b.units.some((u) => soldOutToday.has(u.productId)))
  /**
   * 選べる一番早い受け取り日
   * お弁当があれば今日から BENTO_LEAD_DAYS 日後、今日の分が売り切れの商品があれば明日から
   */
  const minPickupDate =
    bentos.length > 0 ? addDays(todayJST(), BENTO_LEAD_DAYS) : hasSoldOutToday ? addDays(todayJST(), 1) : null
  const pickupNote =
    bentos.length > 0
      ? `※ お弁当は${BENTO_LEAD_DAYS}日前までのご予約のため、${BENTO_LEAD_DAYS}日後以降の日を選べます`
      : hasSoldOutToday
        ? '※ 本日分が売り切れの商品があるため、明日以降の日を選べます'
        : undefined
  /** 今日の分が売り切れの商品に添える注意書き */
  const noteOf = (product: Product) =>
    soldOutToday.has(product.id) ? '本日分は売り切れ・明日以降のお受け取りで注文できます' : undefined

  const handleBentoAdd = useCallback((product: Product, units: LunchNigiriUnit[]) => {
    setBentos((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, product, units }])
    setBentoSheet(null)
  }, [])
  /** 同じお弁当の最後の1つを取り除く */
  const handleBentoRemove = useCallback((product: Product) => {
    setBentos((prev) => {
      const idx = prev.findLastIndex((b) => b.product.id === product.id)
      return idx === -1 ? prev : prev.filter((_, i) => i !== idx)
    })
  }, [])
  const handleBentoDelete = useCallback((bento: CartPlate) => {
    setBentos((prev) => prev.filter((b) => b.id !== bento.id))
  }, [])
  const tonjiruProduct = products.find((p) => p.name.includes('豚汁'))

  /** メニューのカードに出す、オプションの組み合わせごとの注文数 */
  const quantityOf = (product: Product) => (options: NigiriOptions) =>
    cartMap.get(cartKey(product.id, options))?.quantity ?? 0

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data: Product[]) => {
        // ランチプレートを除外し、同名商品の重複を除去（DB重複対策）
        const seen = new Set<string>()
        const unique = data.filter((p) => {
          if (isLunchPlate(p)) return false
          if (seen.has(p.name)) return false
          seen.add(p.name)
          return true
        })
        // テイクアウト予約では、今日の分が売り切れの商品も選べるようにする（受け取り日を明日以降にする）
        // 席からのお持ち帰りはその場で渡すので、売り切れのまま
        if (isSeatOrder) {
          setProducts(unique)
        } else {
          const ids = new Set(
            unique
              .filter((p) => p.is_sold_out && !(p as Product & { sales_paused_until?: string }).sales_paused_until)
              .map((p) => p.id),
          )
          setSoldOutToday(ids)
          setProducts(unique.map((p) => (ids.has(p.id) ? { ...p, is_sold_out: false } : p)))
        }
        setLoading(false)
      })
      .catch(() => {
        setError('商品情報の取得に失敗しました')
        setLoading(false)
      })
    // オプションの売り切れ状態（取れなければ全部選べる扱い）
    fetch('/api/options')
      .then((r) => (r.ok ? r.json() : NO_OPTION_SOLD_OUT))
      .then((data: OptionSoldOut) => setOptionSoldOut(data))
      .catch(() => {})
  }, [])

  /** おにぎり用 */
  const handleAdd = useCallback((product: Product, options: NigiriOptions = NO_OPTIONS) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = cartKey(product.id, options)
      const existing = next.get(key)
      if (existing) {
        next.set(key, { ...existing, quantity: existing.quantity + 1 })
      } else {
        next.set(key, {
          product,
          quantity: 1,
          with_topping: options.tororo,
          with_egg_yolk: options.eggYolk,
          with_large: options.large,
        })
      }
      return next
    })
  }, [])

  const handleRemove = useCallback((product: Product, options: NigiriOptions) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = cartKey(product.id, options)
      const existing = next.get(key)
      if (!existing) return prev
      if (existing.quantity > 1) next.set(key, { ...existing, quantity: existing.quantity - 1 })
      else next.delete(key)
      return next
    })
  }, [])

  /** カートの個数変更（delta: +1 / -1）。0個になった行は削除する */
  const handleCartQuantityChange = useCallback((item: CartItem, delta: number) => {
    const key = cartKey(item.product.id, optionsOf(item))
    setCartMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(key)
      if (!existing) return prev
      const quantity = existing.quantity + delta
      if (quantity <= 0) next.delete(key)
      else next.set(key, { ...existing, quantity })
      return next
    })
  }, [])

  /** カートから商品を削除する */
  const handleCartItemDelete = useCallback((item: CartItem) => {
    const key = cartKey(item.product.id, optionsOf(item))
    setCartMap((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (cartItems.length === 0 && bentos.length === 0) return
    setIsSubmitting(true)

    const items = cartItems.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.price,
      with_topping: item.with_topping,
      with_egg_yolk: !!item.with_egg_yolk,
      with_large: !!item.with_large,
    }))
    // お弁当は1つずつ、お弁当の行と中のおにぎりの行にする（おにぎりには何番目のお弁当かを付ける）
    // 値段はサーバーで付け直す
    const bentoItems = bentos.flatMap((bento, index) => [
      {
        product_id: bento.product.id,
        product_name: bento.product.name,
        quantity: 1,
        unit_price: bento.product.price,
        with_topping: false,
        container_index: index,
      },
      ...bento.units.map((unit) => ({
        product_id: unit.productId,
        product_name: products.find((p) => p.id === unit.productId)?.name ?? '',
        quantity: 1,
        unit_price: 0,
        with_topping: false,
        lunch_plate_index: index,
      })),
    ])

    try {
      // 席からのお持ち帰りは、その卓の伝票に加える（LINE通知は送らない）
      const res = isSeatOrder
        ? await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_id: seatTableId,
              items: items.map((item) => ({ ...item, is_takeout: true })),
            }),
          })
        : await fetch('/api/takeout/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_id: TAKEOUT_TABLE_ID,
              line_user_id: lineUserId ?? undefined,
              pickup_at: pickupDate && pickupTime ? `${pickupDate} ${pickupTime}` : undefined,
              customer_name: lineDisplayName ?? undefined,
              items: [...items, ...bentoItems],
            }),
          })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? '注文に失敗しました')
      }

      const { order_id } = await res.json()
      router.push(
        isSeatOrder
          ? `/order/complete?seat=${encodeURIComponent(seat ?? '')}&orderId=${encodeURIComponent(order_id)}`
          : `/takeout/complete?orderId=${encodeURIComponent(order_id)}`,
      )
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }, [cartItems, bentos, products, lineUserId, lineDisplayName, pickupDate, pickupTime, router, isSeatOrder, seat, seatTableId])

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
            {isSeatOrder ? 'お持ち帰り' : 'テイクアウト'}
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
          <p className="text-white text-lg font-bold drop-shadow">
            {isSeatOrder ? 'お持ち帰りのご注文' : 'テイクアウト注文'}
          </p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-3 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-brown-400 text-lg">メニューを読み込み中...</p>
          </div>
        ) : (
          <>
            {/* おすすめ（押すとそのままカートに入る） */}
            <RecommendedItem
              // おすすめは今日すぐ受け取れる商品から選ぶ
              products={products.filter((p) => !soldOutToday.has(p.id))}
              optionSoldOut={optionSoldOut}
              getQuantity={(p, o) => quantityOf(p)(o)}
              onAdd={handleAdd}
            />

            {/* おにぎり */}
            <section>
              <h1 className="section-title mb-4 px-1">おにぎり</h1>
              <div className="grid grid-cols-2 gap-3">
                {nigiriProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    getQuantity={quantityOf(product)}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    optionSoldOut={optionSoldOut}
                    note={noteOf(product)}
                  />
                ))}
              </div>
            </section>

            {/* お弁当（2日前までの予約。押すと中のおにぎりを選ぶ） */}
            {bentoProducts.length > 0 && (
              <section>
                <h2 className="section-title mb-1 px-1">お弁当</h2>
                <p className="text-sm text-amber-700 font-bold mb-3 px-1">
                  ※ {BENTO_LEAD_DAYS}日前までのご予約が必要です（{BENTO_LEAD_DAYS}日後以降のお受け取り）
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {bentoProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      getQuantity={() => bentos.filter((b) => b.product.id === product.id).length}
                      onAdd={() => setBentoSheet(product)}
                      onRemove={() => handleBentoRemove(product)}
                      note={noteOf(product)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* サイド（豚汁など） */}
            {sideProducts.length > 0 && (
              <section>
                <h2 className="section-title mb-3 px-1">サイド</h2>
                <div className="grid grid-cols-2 gap-3">
                  {sideProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      getQuantity={quantityOf(product)}
                      onAdd={handleAdd}
                      onRemove={handleRemove}
                      note={noteOf(product)}
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
        pickupDate={pickupDate}
        pickupTime={pickupTime}
        onPickupSelect={handlePickupSelect}
        onAddItem={handleAdd}
        onQuantityChange={handleCartQuantityChange}
        onItemDelete={handleCartItemDelete}
        isSeatOrder={isSeatOrder}
        tonjiruProduct={tonjiruProduct}
        bentos={bentos}
        allProducts={products}
        onBentoDelete={handleBentoDelete}
        minPickupDate={minPickupDate}
        pickupNote={pickupNote}
      />

      {bentoSheet && (
        <LunchPlateSheet
          plate={bentoSheet}
          products={products}
          onAdd={(units) => handleBentoAdd(bentoSheet, units)}
          onClose={() => setBentoSheet(null)}
        />
      )}
    </div>
  )
}
