'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ProductCard from '@/components/customer/ProductCard'
import DrinkCard from '@/components/customer/DrinkCard'
import Cart from '@/components/customer/Cart'
import LunchPlateSheet from '@/components/customer/LunchPlateSheet'
import type {
  Product,
  CartItem,
  CartPlate,
  LunchNigiriUnit,
  NigiriOptions,
  OptionSoldOut,
} from '@/lib/types'
import {
  TABLE_NAMES,
  storageUrl,
  isLunchPlate,
  LUNCH_START_HOUR,
  LUNCH_PLATE_END_HOUR,
  LUNCH_PLATE_ALWAYS_AVAILABLE,
  isLunchTimeNow,
  isLunchPlateOrderable,
  isLunchPlateClosed,
  getLunchPlateSurcharge,
  DRINK_CATEGORY,
  NO_OPTIONS,
  NO_OPTION_SOLD_OUT,
  TAKEOUT_ONLY_CATEGORY,
  isHiddenFromMenu,
  optionsOfItem,
} from '@/lib/types'

interface Props {
  tableId: string
  lineUserId?: string | null
  partySize?: number | null
  buildCompleteHref: (orderId: string) => string
}

/**
 * カートのキー: おにぎり系はオプション（とろろ昆布・漬け卵黄）とお持ち帰りかどうか、何人目の分かで区別、
 * ドリンクは商品と何人目の分かで区別。同じ商品でも組み合わせが違えば別の行として持つ
 */
const dinerSuffix = (diner?: number) => (diner ? `-d${diner}` : '')
const cartKey = (productId: string, options: NigiriOptions, takeout = false, diner?: number) =>
  `${productId}-${options.tororo}${options.eggYolk ? '-egg' : ''}${options.large ? '-large' : ''}${takeout ? '-takeout' : ''}${dinerSuffix(diner)}`
const drinkKey = (productId: string, diner?: number) => `${productId}-drink${dinerSuffix(diner)}`

export default function OrderUI({ tableId, lineUserId, partySize, buildCompleteHref }: Props) {
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cartMap, setCartMap] = useState<Map<string, CartItem>>(new Map())
  /** とろろ昆布・漬け卵黄の売り切れ状態 */
  const [optionSoldOut, setOptionSoldOut] = useState<OptionSoldOut>(NO_OPTION_SOLD_OUT)
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** 今メニューから追加する分が、店内で食べるものかお持ち帰りか */
  const [orderMode, setOrderMode] = useState<'eatin' | 'takeout'>('eatin')
  const isTakeoutMode = orderMode === 'takeout'

  /** カートに入れたランチプレート（おにぎりは追加するときに選び終えている） */
  const [plates, setPlates] = useState<CartPlate[]>([])
  /** おにぎりを選んでいる途中のランチプレート */
  const [plateSheet, setPlateSheet] = useState<Product | null>(null)

  /**
   * 2名以上のときは「1人目｜2人目…」を選んでから商品を追加する（同じ人の分を1皿にまとめるため）
   * お持ち帰り分は分けない
   */
  const hasDiners = (partySize ?? 0) >= 2
  const [currentDiner, setCurrentDiner] = useState(1)
  const activeDiner = hasDiners && !isTakeoutMode ? currentDiner : undefined

  const cartItems: CartItem[] = Array.from(cartMap.values())

  const nigiriProducts = products.filter((p) => p.category === 'おにぎり')
  const drinkProducts = products.filter((p) => p.category === DRINK_CATEGORY)
  const lunchPlateProducts = products.filter(isLunchPlate)
  // テイクアウト限定の商品（おかずパックなど）は、お持ち帰りを選んでいるときだけ出す
  const sideProducts = products.filter(
    (p) =>
      p.category !== 'おにぎり' &&
      p.category !== DRINK_CATEGORY &&
      (isTakeoutMode || p.category !== TAKEOUT_ONLY_CATEGORY) &&
      !isHiddenFromMenu(p) &&
      !isLunchPlate(p),
  )
  const tonjiruProduct = products.find((p) => p.name.includes('豚汁'))

  /** ランチタイム判定（11:00〜14:00）。注文の制限はなく、並び順の切り替えにのみ使う */
  const isLunchTime = isLunchTimeNow()
  /** ランチプレートの注文可否（11:00〜15:00） */
  const plateOrderable = isLunchPlateOrderable()
  /** 15:00以降は販売終了。非表示にはせずグレーアウトで残す */
  const plateClosed = isLunchPlateClosed()

  /** 切り替えボタンに表示する、店内分・お持ち帰り分それぞれの点数 */
  const eatinCount =
    cartItems.filter((item) => !item.is_takeout).reduce((sum, item) => sum + item.quantity, 0) + plates.length
  const takeoutCount = cartItems
    .filter((item) => item.is_takeout)
    .reduce((sum, item) => sum + item.quantity, 0)

  /** 「○人目」のタブに出す点数 */
  const dinerCount = (diner: number) =>
    cartItems.filter((i) => !i.is_takeout && i.diner_no === diner).reduce((sum, i) => sum + i.quantity, 0) +
    plates.filter((p) => p.diner_no === diner).length

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
    // オプションの売り切れ状態（取れなければ全部選べる扱い）
    fetch('/api/options')
      .then((r) => (r.ok ? r.json() : NO_OPTION_SOLD_OUT))
      .then((data: OptionSoldOut) => setOptionSoldOut(data))
      .catch(() => {})
  }, [])

  /**
   * おにぎり・ランチプレート用
   * オプションの組み合わせごとに別の行として持つので、同じおにぎりを
   * 「とろろ昆布に変更するもの」「漬け卵黄を追加するもの」などに分けて注文できる
   */
  const addToCart = useCallback((product: Product, options: NigiriOptions, takeout: boolean, diner?: number) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = cartKey(product.id, options, takeout, diner)
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
          ...(takeout ? { is_takeout: true } : {}),
          ...(diner ? { diner_no: diner } : {}),
        })
      }
      return next
    })
  }, [])

  const removeFromCart = useCallback((product: Product, options: NigiriOptions, takeout: boolean, diner?: number) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = cartKey(product.id, options, takeout, diner)
      const existing = next.get(key)
      if (!existing) return prev
      if (existing.quantity > 1) next.set(key, { ...existing, quantity: existing.quantity - 1 })
      else next.delete(key)
      return next
    })
  }, [])

  /**
   * メニューからの追加・削除は、選んでいるモード（店内／お持ち帰り）と「○人目」に入れる
   * ランチプレートは、追加するときにその場で中のおにぎりを選んでもらう
   */
  const handleAdd = useCallback(
    (product: Product, options: NigiriOptions) => {
      if (isLunchPlate(product)) {
        setPlateSheet(product)
        return
      }
      addToCart(product, options, isTakeoutMode, activeDiner)
    },
    [addToCart, isTakeoutMode, activeDiner],
  )
  const handleRemove = useCallback(
    (product: Product, options: NigiriOptions) => {
      if (isLunchPlate(product)) {
        // 同じ人の、同じプレートの最後の1枚を取り除く
        setPlates((prev) => {
          const idx = prev.findLastIndex((p) => p.product.id === product.id && p.diner_no === activeDiner)
          return idx === -1 ? prev : prev.filter((_, i) => i !== idx)
        })
        return
      }
      removeFromCart(product, options, isTakeoutMode, activeDiner)
    },
    [removeFromCart, isTakeoutMode, activeDiner],
  )
  /** カートの「豚汁を追加」は店内分として、選んでいる人の分に追加する */
  const handleAddEatin = useCallback(
    (product: Product) => addToCart(product, NO_OPTIONS, false, hasDiners ? currentDiner : undefined),
    [addToCart, hasDiners, currentDiner],
  )

  const handlePlateAdd = useCallback(
    (product: Product, units: LunchNigiriUnit[]) => {
      setPlates((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, product, units, diner_no: activeDiner }])
      setPlateSheet(null)
    },
    [activeDiner],
  )
  const handlePlateDelete = useCallback((plate: CartPlate) => {
    setPlates((prev) => prev.filter((p) => p.id !== plate.id))
  }, [])

  /** メニューのカードに出す、選んでいるモード・人での注文数 */
  const quantityOf = (product: Product) => (options: NigiriOptions) =>
    isLunchPlate(product)
      ? plates.filter((p) => p.product.id === product.id && p.diner_no === activeDiner).length
      : cartMap.get(cartKey(product.id, options, isTakeoutMode, activeDiner))?.quantity ?? 0

  /** ドリンク用 */
  const handleAddDrink = useCallback((product: Product) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = drinkKey(product.id, activeDiner)
      const existing = next.get(key)
      if (existing) {
        next.set(key, { ...existing, quantity: existing.quantity + 1 })
      } else {
        next.set(key, {
          product,
          quantity: 1,
          with_topping: false,
          timing: undefined,
          ...(activeDiner ? { diner_no: activeDiner } : {}),
        })
      }
      return next
    })
  }, [activeDiner])

  const handleRemoveDrink = useCallback((product: Product) => {
    setCartMap((prev) => {
      const next = new Map(prev)
      const key = drinkKey(product.id, activeDiner)
      const existing = next.get(key)
      if (existing) {
        if (existing.quantity > 1) next.set(key, { ...existing, quantity: existing.quantity - 1 })
        else next.delete(key)
      }
      return next
    })
  }, [activeDiner])

  /** カート内の行のキー（おにぎり系とドリンクでキーの作り方が違う） */
  const itemKey = (item: CartItem) =>
    item.product.category === DRINK_CATEGORY
      ? drinkKey(item.product.id, item.diner_no)
      : cartKey(item.product.id, optionsOfItem(item), !!item.is_takeout, item.diner_no)

  /** カートの個数変更（delta: +1 / -1）。0個になった行は削除する */
  const handleCartQuantityChange = useCallback((item: CartItem, delta: number) => {
    const key = itemKey(item)
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
    const key = itemKey(item)
    setCartMap((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (cartItems.length === 0 && plates.length === 0) return
    setIsSubmitting(true)

    try {
      // ランチプレートは1枚ずつ、プレートの行と中のおにぎりの行にする（おにぎりにはプレート番号を付ける）
      // おにぎりの個数は商品（1個用/2個用）の価格に含まれるため、
      // おにぎりの行で加算するのは種類ごとの追加料金のみ
      const plateItems = plates.flatMap((plate, plateIndex) => [
        {
          product_id: plate.product.id,
          product_name: plate.product.name,
          quantity: 1,
          unit_price: plate.product.price,
          with_topping: false,
          timing: null,
          ...(plate.diner_no ? { diner_no: plate.diner_no } : {}),
        },
        ...plate.units.flatMap((unit) => {
          const product = products.find((p) => p.id === unit.productId)
          if (!product) return []
          return [{
            product_id: unit.productId,
            product_name: product.name,
            quantity: 1,
            unit_price: getLunchPlateSurcharge(product),
            with_topping: unit.tororo,
            with_egg_yolk: !!unit.eggYolk,
            with_large: !!unit.large,
            timing: null,
            lunch_plate_index: plateIndex,
            ...(plate.diner_no ? { diner_no: plate.diner_no } : {}),
          }]
        }),
      ])

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
              with_egg_yolk: !!item.with_egg_yolk,
              with_large: !!item.with_large,
              timing: item.timing ?? null,
              ...(item.is_takeout ? { is_takeout: true } : {}),
              ...(item.diner_no ? { diner_no: item.diner_no } : {}),
            })),
            ...plateItems,
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
  }, [cartItems, plates, products, tableId, lineUserId, partySize, buildCompleteHref, router])

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

        {/* 追加先の切り替え。店内分とお持ち帰り分は同じ注文でまとめて確定できる */}
        <div className="max-w-2xl mx-auto px-3 pb-2">
          <div className="grid grid-cols-2 gap-1 bg-cream-200 rounded-xl p-1">
            {(
              [
                ['eatin', '店内でお召し上がり', eatinCount],
                ['takeout', 'お持ち帰り', takeoutCount],
              ] as const
            ).map(([mode, label, count]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setOrderMode(mode)}
                className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                  orderMode === mode
                    ? mode === 'takeout'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-brown-800 shadow-sm'
                    : 'text-brown-500'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="ml-1 text-xs tabular-nums">（{count}）</span>
                )}
              </button>
            ))}
          </div>

          {/* 2名以上: 誰の分を選んでいるか（同じ人の分を1皿にまとめてお出しするため） */}
          {hasDiners && !isTakeoutMode && (
            <div className="mt-2">
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {Array.from({ length: partySize ?? 0 }, (_, i) => i + 1).map((n) => {
                  const count = dinerCount(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCurrentDiner(n)}
                      aria-pressed={currentDiner === n}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors ${
                        currentDiner === n
                          ? 'bg-brown-600 border-brown-600 text-white'
                          : 'bg-white border-cream-300 text-brown-600'
                      }`}
                    >
                      {n}人目
                      {count > 0 && <span className="ml-1 text-xs tabular-nums">（{count}）</span>}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-brown-500 mt-1 px-1">
                {currentDiner}人目の方のご注文を選んでいます（お一人ずつ1皿にまとめてお出しします）
              </p>
            </div>
          )}
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

      {/* 注文のお願い */}
      <div className="max-w-2xl mx-auto px-3 pt-4">
        <p className="text-sm font-medium text-brown-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
          おひとり様2点以上のご注文をお願いいたします。<br />
          <span className="text-xs text-brown-500">（ランチプレートを除く）</span>
        </p>
      </div>

      <main className="max-w-2xl mx-auto px-3 py-4 space-y-6">
        {isTakeoutMode && (
          <p className="text-sm font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-xl px-4 py-3">
            お持ち帰り分を選んでいます。店内のご注文と一緒に確定でき、お会計時にお渡しします。
          </p>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-brown-400 text-lg">メニューを読み込み中...</p>
          </div>
        ) : (() => {
          // ─ 各セクションを変数化し、ランチタイム中はドリンクをおにぎりの上に表示する ─
          const lunchPlateSection = lunchPlateProducts.length > 0 && (
            <section key="lunch-plate">
              <h1 className="section-title mb-1 px-1">ランチプレート</h1>
              <p className={`text-xs mb-3 px-1 ${plateOrderable ? 'text-brown-500' : 'text-amber-700 font-medium'}`}>
                {plateOrderable
                  ? `おにぎり1個 ¥1,300~・2個 ¥1,500~${LUNCH_PLATE_ALWAYS_AVAILABLE ? '' : `（${LUNCH_START_HOUR}:00〜${LUNCH_PLATE_END_HOUR}:00 限定）`}`
                  : plateClosed
                    ? `本日のランチプレートは終了しました（${LUNCH_START_HOUR}:00〜${LUNCH_PLATE_END_HOUR}:00）`
                    : `ご注文は ${LUNCH_START_HOUR}:00 からです`}
              </p>
              <div className={`grid grid-cols-2 gap-3 ${!plateOrderable ? 'opacity-50 pointer-events-none' : ''}`}>
                {lunchPlateProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    getQuantity={quantityOf(product)}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          )

          const nigiriSection = (
            <section key="nigiri">
              <h2 className="section-title mb-3 px-1">おにぎり</h2>
              <div className="grid grid-cols-2 gap-3">
                {nigiriProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    getQuantity={quantityOf(product)}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    optionSoldOut={optionSoldOut}
                  />
                ))}
              </div>
            </section>
          )

          const sideSection = sideProducts.length > 0 && (
            <section key="side">
              <h2 className="section-title mb-3 px-1">サイド</h2>
              <div className="grid grid-cols-2 gap-3">
                {sideProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    getQuantity={quantityOf(product)}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                  />
                ))}
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
                    quantity={cartMap.get(drinkKey(product.id, activeDiner))?.quantity ?? 0}
                    onAdd={() => handleAddDrink(product)}
                    onRemove={() => handleRemoveDrink(product)}
                  />
                ))}
              </div>
            </section>
          )

          // お持ち帰り: おにぎり → サイド（ランチプレート・ドリンクは店内のみ）
          if (isTakeoutMode) {
            return (
              <>
                {nigiriSection}
                {sideSection}
              </>
            )
          }

          // ランチ中: プレート → ドリンク → おにぎり → サイド
          // 通常時:   プレート → おにぎり → サイド → ドリンク
          // ※ランチ中も全商品を注文できる。並び順だけを入れ替えている
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

        {/* お持ち帰りの導線。同じ画面で切り替えて、店内分と一緒に注文できる */}
        {!loading && (
          <section className="pt-2">
            <div className="rounded-2xl border border-cream-300 bg-white p-4 text-center space-y-2">
              {isTakeoutMode ? (
                <>
                  <p className="font-bold text-brown-800">店内でお召し上がりの分もございますか？</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderMode('eatin')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="block w-full py-3 rounded-xl border-2 border-brown-600 text-brown-700 font-bold text-base active:bg-cream-100"
                  >
                    店内のメニューに戻る
                  </button>
                </>
              ) : (
                <>
                  <p className="font-bold text-brown-800">お持ち帰りもご一緒にいかがですか？</p>
                  <p className="text-xs text-brown-500">
                    店内のご注文と一緒に確定でき、お会計時にお渡しします
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderMode('takeout')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="block w-full py-3 rounded-xl border-2 border-amber-500 text-amber-700 font-bold text-base active:bg-amber-50"
                  >
                    お持ち帰りを追加する
                  </button>
                </>
              )}
            </div>
          </section>
        )}
      </main>

      <Cart
        items={cartItems}
        plates={plates}
        onSubmit={handleSubmit}
        dinerCount={hasDiners ? partySize ?? 0 : 0}
        isSubmitting={isSubmitting}
        allProducts={products}
        onQuantityChange={handleCartQuantityChange}
        onItemDelete={handleCartItemDelete}
        onPlateDelete={handlePlateDelete}
        onAddItem={handleAddEatin}
        tonjiruProduct={tonjiruProduct}
        tonjiruTargetLabel={hasDiners ? `${currentDiner}人目` : undefined}
      />

      {/* ランチプレートを追加するときに、その場で中のおにぎりを選ぶ */}
      {plateSheet && (
        <LunchPlateSheet
          plate={plateSheet}
          products={products}
          optionSoldOut={optionSoldOut}
          dinerLabel={activeDiner ? `${activeDiner}人目` : undefined}
          onAdd={(units) => handlePlateAdd(plateSheet, units)}
          onClose={() => setPlateSheet(null)}
        />
      )}
    </div>
  )
}
