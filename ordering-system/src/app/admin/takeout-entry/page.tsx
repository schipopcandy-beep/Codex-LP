'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { NigiriOptions, OptionSoldOut, Product } from '@/lib/types'
import {
  DRINK_CATEGORY,
  EGG_YOLK_NAME,
  NIGIRI_CATEGORY,
  NO_OPTIONS,
  NO_OPTION_SOLD_OUT,
  TAKEOUT_TABLE_ID,
  TOPPING_NAME,
  isLunchPlate,
  isToppingSelectable,
  optionLabel,
  optionPrice,
  orderShortId,
} from '@/lib/types'

/** 商品ID とオプションの組み合わせごとの個数 */
type Quantities = Record<string, number>

const qtyKey = (productId: string, options: NigiriOptions) =>
  `${productId}-${options.tororo}-${options.eggYolk}`

/** オプションを付けた組み合わせ（「そのまま」以外） */
const OPTION_COMBOS: { options: NigiriOptions; label: string; soldOut: (s: OptionSoldOut) => boolean }[] = [
  { options: { tororo: true, eggYolk: false }, label: `${TOPPING_NAME}に変更`, soldOut: (s) => s.tororo },
  { options: { tororo: false, eggYolk: true }, label: `${EGG_YOLK_NAME}を追加`, soldOut: (s) => s.egg_yolk },
  {
    options: { tororo: true, eggYolk: true },
    label: `${TOPPING_NAME}に変更＋${EGG_YOLK_NAME}`,
    soldOut: (s) => s.tororo || s.egg_yolk,
  },
]
const ALL_COMBOS: NigiriOptions[] = [NO_OPTIONS, ...OPTION_COMBOS.map((c) => c.options)]

/** 日本時間の今日の日付（YYYY-MM-DD）と現在時刻（HH:MM） */
function jstNow(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/**
 * 店頭テイクアウトの注文入力（店員用）
 * 店内で食べずにお持ち帰りだけのお客様の注文を、店員がその場で登録する。
 * LINEの確認メッセージは送らない。
 */
export default function TakeoutEntryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [optionSoldOut, setOptionSoldOut] = useState<OptionSoldOut>(NO_OPTION_SOLD_OUT)
  const [loading, setLoading] = useState(true)
  const [quantities, setQuantities] = useState<Quantities>({})
  /** オプションの入力欄を開いている商品 */
  const [openOptions, setOpenOptions] = useState<Set<string>>(new Set())
  const [customerName, setCustomerName] = useState('')
  const [pickupMode, setPickupMode] = useState<'now' | 'later'>('now')
  const [pickupTime, setPickupTime] = useState(() => jstNow().time)
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data: Product[]) => {
        // テイクアウトの画面と同じく、ランチプレートとドリンクは扱わない
        setProducts(data.filter((p) => !isLunchPlate(p) && p.category !== DRINK_CATEGORY))
        setLoading(false)
      })
      .catch(() => setLoading(false))
    fetch('/api/options')
      .then((r) => (r.ok ? r.json() : NO_OPTION_SOLD_OUT))
      .then((data: OptionSoldOut) => setOptionSoldOut(data))
      .catch(() => {})
  }, [])

  const nigiriProducts = products.filter((p) => p.category === NIGIRI_CATEGORY)
  const otherProducts = products.filter((p) => p.category !== NIGIRI_CATEGORY)

  const change = (productId: string, options: NigiriOptions, delta: number) => {
    setRegistered(null)
    setQuantities((prev) => {
      const key = qtyKey(productId, options)
      const next = Math.max(0, (prev[key] ?? 0) + delta)
      return { ...prev, [key]: next }
    })
  }

  /** 登録する明細（個数が1以上のもの） */
  const lines = useMemo(
    () =>
      products.flatMap((product) =>
        ALL_COMBOS.flatMap((options) => {
          const quantity = quantities[qtyKey(product.id, options)] ?? 0
          return quantity > 0
            ? [{ product, options, quantity, with_topping: options.tororo, with_egg_yolk: options.eggYolk }]
            : []
        }),
      ),
    [products, quantities],
  )

  const total = lines.reduce((sum, l) => sum + (l.product.price + optionPrice(l)) * l.quantity, 0)
  const totalCount = lines.reduce((sum, l) => sum + l.quantity, 0)

  const handleSubmit = async () => {
    if (lines.length === 0 || submitting) return
    setSubmitting(true)

    const { date, time } = jstNow()
    const pickupAt = `${date} ${pickupMode === 'now' ? time : pickupTime}`

    try {
      const res = await fetch('/api/takeout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: TAKEOUT_TABLE_ID,
          pickup_at: pickupAt,
          customer_name: customerName.trim() || undefined,
          staff_entry: true,
          items: lines.map((l) => ({
            product_id: l.product.id,
            product_name: l.product.name,
            quantity: l.quantity,
            unit_price: l.product.price,
            with_topping: l.with_topping,
            with_egg_yolk: l.with_egg_yolk,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '登録に失敗しました')
      }
      const { order_id } = await res.json()
      setRegistered(orderShortId(order_id))
      setQuantities({})
      setOpenOptions(new Set())
      setCustomerName('')
      setPickupMode('now')
      setPickupTime(jstNow().time)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  /** 1商品・1組み合わせ分の個数操作 */
  const Stepper = ({
    product,
    options,
    disabled = false,
  }: {
    product: Product
    options: NigiriOptions
    disabled?: boolean
  }) => {
    const quantity = quantities[qtyKey(product.id, options)] ?? 0
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => change(product.id, options, -1)}
          disabled={quantity === 0}
          className="w-9 h-9 rounded-full border border-brown-400 text-brown-600 font-bold text-xl leading-none flex items-center justify-center disabled:opacity-30 active:bg-cream-200"
          aria-label="減らす"
        >
          −
        </button>
        <span className="w-6 text-center font-bold text-brown-800 tabular-nums">{quantity}</span>
        <button
          type="button"
          onClick={() => change(product.id, options, 1)}
          disabled={product.is_sold_out || disabled}
          className="w-9 h-9 rounded-full bg-brown-600 text-white font-bold text-xl leading-none flex items-center justify-center disabled:opacity-30 active:bg-brown-700"
          aria-label="増やす"
        >
          ＋
        </button>
      </div>
    )
  }

  const ProductRow = ({ product }: { product: Product }) => {
    const hasOptions = isToppingSelectable(product)
    const optionCount = OPTION_COMBOS.reduce(
      (sum, c) => sum + (quantities[qtyKey(product.id, c.options)] ?? 0),
      0,
    )
    // オプション付きの注文がある商品は、開いたままにする
    const isOpen = hasOptions && (openOptions.has(product.id) || optionCount > 0)
    const toggleOpen = () =>
      setOpenOptions((prev) => {
        const next = new Set(prev)
        if (next.has(product.id)) next.delete(product.id)
        else next.add(product.id)
        return next
      })

    return (
      <div className={`py-3 border-b border-cream-200 space-y-2 ${product.is_sold_out ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-brown-800">
              {product.name}
              {product.is_sold_out && <span className="ml-2 text-xs text-red-600">売り切れ</span>}
            </p>
            <p className="text-sm text-brown-500 tabular-nums">
              ¥{product.price.toLocaleString()}
              {hasOptions && !product.is_sold_out && (
                <button
                  type="button"
                  onClick={toggleOpen}
                  disabled={optionCount > 0}
                  className="ml-3 text-xs text-brown-500 underline underline-offset-2 disabled:no-underline"
                >
                  {isOpen ? 'オプションを閉じる' : 'オプション（とろろ昆布・漬け卵黄）'}
                </button>
              )}
            </p>
          </div>
          <Stepper product={product} options={NO_OPTIONS} />
        </div>
        {isOpen &&
          OPTION_COMBOS.map((c) => {
            const soldOut = c.soldOut(optionSoldOut)
            return (
              <div key={c.label} className="flex items-center justify-between gap-3 pl-3">
                <p className={`text-sm ${soldOut ? 'text-brown-300' : 'text-brown-500'}`}>
                  {c.label}（+¥{optionPrice({ with_topping: c.options.tororo, with_egg_yolk: c.options.eggYolk })}）
                  {soldOut && <span className="ml-1 text-xs">売り切れ</span>}
                </p>
                <Stepper product={product} options={c.options} disabled={soldOut} />
              </div>
            )
          })}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="section-title">店頭テイクアウト入力</h1>
        <Link href="/admin" className="text-sm text-brown-500 underline">
          注文一覧へ
        </Link>
      </div>
      <p className="text-sm text-brown-500 mb-4">
        店内でお召し上がりにならず、お持ち帰りだけのお客様の注文を登録します。LINEの確認メッセージは送られません。
      </p>

      {registered && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-300 text-brown-800">
          注文番号 <span className="font-bold">No. {registered}</span> を登録しました。注文一覧に表示されます。
        </div>
      )}

      {/* お客様情報 */}
      <div className="card p-4 mb-4 space-y-4">
        <label className="block">
          <span className="font-bold text-brown-700">お名前</span>
          <span className="text-xs text-brown-400 ml-2">任意・注文一覧に表示されます</span>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={50}
            placeholder="例：織田"
            className="mt-2 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-base text-brown-800"
          />
        </label>

        <div>
          <p className="font-bold text-brown-700 mb-2">お渡し</p>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['now', '今すぐ'],
                ['later', '時間を指定'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPickupMode(mode)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border ${
                  pickupMode === mode
                    ? 'bg-brown-600 text-white border-brown-600'
                    : 'bg-white text-brown-600 border-cream-300'
                }`}
              >
                {label}
              </button>
            ))}
            {pickupMode === 'later' && (
              <input
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-base text-brown-800"
              />
            )}
          </div>
          <p className="text-xs text-brown-400 mt-1">本日の受取として登録します</p>
        </div>
      </div>

      {/* 商品 */}
      {loading ? (
        <p className="text-center text-brown-400 py-10">メニューを読み込み中...</p>
      ) : (
        <div className="card px-4 py-2 mb-4">
          <p className="font-bold text-brown-700 pt-2">おにぎり</p>
          {nigiriProducts.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
          {otherProducts.length > 0 && (
            <>
              <p className="font-bold text-brown-700 pt-4">サイド</p>
              {otherProducts.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
            </>
          )}
        </div>
      )}

      {/* 合計と登録。固定（fixed）だと横長の画面で一番下の商品が隠れるため、
          ページの最後に場所を取る sticky にして、下までスクロールすれば全部見えるようにする */}
      <div className="sticky bottom-0 z-40 -mx-4 md:-mx-6 bg-white border-t border-cream-300 shadow-lg">
        <div className="px-4 py-3 space-y-2">
          {lines.length > 0 && (
            <div className="max-h-[20vh] overflow-y-auto text-sm text-brown-600 space-y-0.5">
              {lines.map((l) => (
                <p key={qtyKey(l.product.id, l.options)} className="flex justify-between gap-2">
                  <span>
                    {l.product.name}
                    {optionLabel(l) && <span className="text-brown-400">（{optionLabel(l)}）</span>}
                    <span className="text-brown-400"> ×{l.quantity}</span>
                  </span>
                  <span className="tabular-nums">
                    ¥{((l.product.price + optionPrice(l)) * l.quantity).toLocaleString()}
                  </span>
                </p>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-brown-800">
              <span className="text-sm">{totalCount}点　</span>
              <span className="text-2xl font-bold tabular-nums">¥{total.toLocaleString()}</span>
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={lines.length === 0 || submitting}
              className="btn-primary px-6 py-3 text-base disabled:opacity-40"
            >
              {submitting ? '登録中...' : '注文を登録する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
