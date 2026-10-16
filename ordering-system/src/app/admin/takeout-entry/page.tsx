'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { NigiriOptions, OptionSoldOut, Product } from '@/lib/types'
import {
  ALL_OPTION_COMBOS,
  EGG_YOLK_CHANGE_LABEL,
  EGG_YOLK_PRICE,
  LARGE_CHANGE_LABEL,
  LARGE_PRICE,
  TOPPING_CHANGE_LABEL,
  TOPPING_PRICE,
  comboLabel,
  CUSTOMER_FEATURE_ROWS,
  DRINK_CATEGORY,
  NIGIRI_CATEGORY,
  NO_OPTIONS,
  NO_OPTION_SOLD_OUT,
  TAKEOUT_TABLE_ID,
  isHiddenFromMenu,
  isLunchPlate,
  isToppingSelectable,
  optionColumns,
  optionLabel,
  optionPrice,
  orderShortId,
  toggleCustomerFeature,
} from '@/lib/types'

/** 商品ID とオプションの組み合わせごとの個数 */
type Quantities = Record<string, number>

const qtyKey = (productId: string, options: NigiriOptions) =>
  `${productId}-${options.tororo}-${options.eggYolk}-${options.large}`

/** オプションを付けた組み合わせ（「そのまま」以外） */
const ALL_COMBOS: NigiriOptions[] = ALL_OPTION_COMBOS

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
  /** 商品ごとに、チェックしているオプション（＋−はこの組み合わせを増減する） */
  const [selectedOptions, setSelectedOptions] = useState<Record<string, NigiriOptions>>({})
  const [customerName, setCustomerName] = useState('')
  /** お客様の特徴（お渡しのときに見分けるため） */
  const [features, setFeatures] = useState<string[]>([])
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
  const otherProducts = products.filter((p) => p.category !== NIGIRI_CATEGORY && !isHiddenFromMenu(p))
  /** 品目を決めずに数だけ入れる「テイクアウト」（店頭入力用の商品） */
  const placeholderProduct = products.find(isHiddenFromMenu)

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
            ? [{ product, options, quantity, ...optionColumns(options) }]
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
          customer_features: features.length > 0 ? features : undefined,
          staff_entry: true,
          items: lines.map((l) => ({
            product_id: l.product.id,
            product_name: l.product.name,
            quantity: l.quantity,
            unit_price: l.product.price,
            with_topping: l.with_topping,
            with_egg_yolk: l.with_egg_yolk,
            with_large: l.with_large,
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
      setSelectedOptions({})
      setCustomerName('')
      setFeatures([])
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
    const hasOptions = isToppingSelectable(product) && !product.is_sold_out
    // お客様の画面と同じく、チェックしたオプションの組み合わせを ＋− で増減する（売り切れのオプションは付けない）
    const checked = selectedOptions[product.id] ?? NO_OPTIONS
    const target: NigiriOptions = {
      tororo: hasOptions && checked.tororo && !optionSoldOut.tororo,
      eggYolk: hasOptions && checked.eggYolk && !optionSoldOut.egg_yolk,
      large: hasOptions && checked.large && !optionSoldOut.large,
    }
    const toggleOption = (key: keyof NigiriOptions) =>
      setSelectedOptions((prev) => ({ ...prev, [product.id]: { ...checked, [key]: !checked[key] } }))
    const optionRows: { key: keyof NigiriOptions; label: string; price: number; soldOut: boolean }[] = [
      { key: 'large', label: LARGE_CHANGE_LABEL, price: LARGE_PRICE, soldOut: optionSoldOut.large },
      { key: 'tororo', label: TOPPING_CHANGE_LABEL, price: TOPPING_PRICE, soldOut: optionSoldOut.tororo },
      { key: 'eggYolk', label: EGG_YOLK_CHANGE_LABEL, price: EGG_YOLK_PRICE, soldOut: optionSoldOut.egg_yolk },
    ]
    /** 注文済みの組み合わせの内訳（2種類以上のときに表示） */
    const ordered = ALL_OPTION_COMBOS.map((options) => ({
      label: comboLabel(options),
      quantity: quantities[qtyKey(product.id, options)] ?? 0,
    })).filter((c) => c.quantity > 0)

    return (
      <div className={`py-3 border-b border-cream-200 space-y-2 ${product.is_sold_out ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-cream-200">
            {product.image_url && (
              <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="56px" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-brown-800">
              {product.name}
              {product.is_sold_out && <span className="ml-2 text-xs text-red-600">売り切れ</span>}
            </p>
            <p className="text-sm text-brown-500 tabular-nums">
              ¥{(product.price + optionPrice(optionColumns(target))).toLocaleString()}
            </p>
          </div>
          <Stepper product={product} options={target} />
        </div>
        {hasOptions && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-1">
            {optionRows.map((o) => (
              <label
                key={o.key}
                className={`flex items-center gap-1.5 text-sm select-none ${
                  o.soldOut ? 'text-brown-300' : 'text-brown-600 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!o.soldOut && checked[o.key]}
                  disabled={o.soldOut}
                  onChange={() => toggleOption(o.key)}
                  className="w-5 h-5 accent-brown-600"
                />
                {o.label}（+¥{o.price}）{o.soldOut && ' 売り切れ'}
              </label>
            ))}
          </div>
        )}
        {(ordered.length > 1 || (ordered.length === 1 && ordered[0].label !== comboLabel(NO_OPTIONS))) && (
          <p className="text-xs text-brown-500 pl-1">
            入力済み：{ordered.map((c) => `${c.label} ${c.quantity}個`).join('・')}
          </p>
        )}
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

        {/* お客様の特徴（注文一覧に表示され、お渡しのときに見分けられる） */}
        <div>
          <p className="font-bold text-brown-700">
            特徴<span className="text-xs text-brown-400 font-normal ml-2">任意・注文一覧に表示されます</span>
          </p>
          <div className="mt-2 space-y-2">
            {CUSTOMER_FEATURE_ROWS.map((row) => (
              <div key={row.join()} className="flex flex-wrap gap-2">
                {row.map((f) => {
                  const selected = features.includes(f)
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setRegistered(null)
                        setFeatures((prev) => toggleCustomerFeature(prev, f))
                      }}
                      aria-pressed={selected}
                      className={`px-3 py-2 rounded-full border-2 text-sm font-bold ${
                        selected
                          ? 'bg-brown-600 border-brown-600 text-white'
                          : 'bg-white border-cream-300 text-brown-600 active:bg-cream-200'
                      }`}
                    >
                      {f}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

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
        <div className="space-y-4 mb-4">
          {/* 忙しいときに、品目を決めずに数だけ先に入れる欄 */}
          <div className="card px-4 py-3 border-2 border-amber-300 bg-amber-50">
            {placeholderProduct ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brown-800">テイクアウト</p>
                  <p className="text-xs text-brown-500">
                    品目を決めずに数だけ入れます（¥0）。あとで注文の修正から品目に置き換えられます
                  </p>
                </div>
                <Stepper product={placeholderProduct} options={NO_OPTIONS} />
              </div>
            ) : (
              <p className="text-sm text-brown-500">
                「テイクアウト」の欄は、案内したSQLを実行すると使えるようになります
              </p>
            )}
          </div>

        <div className="card px-4 py-2">
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
