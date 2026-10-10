'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import type { OptionKey, OptionSoldOut, Product } from '@/lib/types'
import type { StockKey, StockStatus } from '@/lib/stock'
import {
  LOW_STOCK_THRESHOLD,
  LUNCH_PLATE_STOCK_KEY,
  optionStockKey,
  productStockKey,
} from '@/lib/stock'
import {
  isLunchPlate,
  NIGIRI_CATEGORY,
  NO_OPTION_SOLD_OUT,
  OPTION_NAMES,
  OPTION_PRICES,
} from '@/lib/types'

/** 販売中・売り切れの切り替えボタン */
function SoldOutButton({
  soldOut,
  busy,
  onClick,
}: {
  soldOut: boolean
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
        soldOut
          ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
          : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      } disabled:opacity-50`}
    >
      {busy ? '...' : soldOut ? '売り切れ' : '販売中'}
    </button>
  )
}

/** 日本時間の今日・明日（YYYY-MM-DD） */
function jstDate(offsetDays: number): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000).toISOString().slice(0, 10)
}

/**
 * 売り切れ管理
 * 商品とオプション（とろろ昆布・漬け卵黄）の売り切れを切り替える。
 * 仕込み数を入れた商品は、注文数から残り数を出し、0になったら自動で売り切れにする。
 * 毎日0時に、すべて販売中に戻る。
 */
export default function SoldOutAdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [optionSoldOut, setOptionSoldOut] = useState<OptionSoldOut>(NO_OPTION_SOLD_OUT)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  /** 仕込み数を入れる日（今日・明日） */
  const [stockDay, setStockDay] = useState<0 | 1>(0)
  const [stock, setStock] = useState<Map<string, StockStatus>>(new Map())
  /** 入力中の仕込み数（保存前） */
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map())

  const fetchAll = useCallback(async () => {
    const [productsRes, optionsRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/options'),
    ])
    if (productsRes.ok) setProducts(await productsRes.json())
    if (optionsRes.ok) setOptionSoldOut(await optionsRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const fetchStock = useCallback(async () => {
    const res = await fetch(`/api/admin/stock?date=${jstDate(stockDay)}`)
    if (!res.ok) return
    const data: { items: StockStatus[] } = await res.json()
    setStock(new Map(data.items.map((s) => [s.stock_key, s])))
    setDrafts(new Map())
  }, [stockDay])

  useEffect(() => {
    fetchStock()
  }, [fetchStock])

  /** 仕込み数を保存する（空欄にすると数の管理をやめる） */
  const savePrepared = async (stockKey: StockKey) => {
    const draft = drafts.get(stockKey)
    if (draft === undefined) return
    const trimmed = draft.trim()
    const current = stock.get(stockKey)?.prepared_qty
    const next = trimmed === '' ? null : Number(trimmed)
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      alert('仕込み数は0以上の整数で入力してください')
      return
    }
    if (next === (current ?? null)) {
      setDrafts((prev) => {
        const m = new Map(prev)
        m.delete(stockKey)
        return m
      })
      return
    }

    setUpdating(`stock-${stockKey}`)
    const res = await fetch('/api/admin/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: jstDate(stockDay), stock_key: stockKey, prepared_qty: next }),
    })
    if (res.ok) {
      await Promise.all([fetchStock(), fetchAll()])
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? '保存に失敗しました')
    }
    setUpdating(null)
  }

  const toggleSoldOut = async (product: Product) => {
    if (updating) return
    setUpdating(product.id)

    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_sold_out: !product.is_sold_out }),
    })

    if (res.ok) {
      const updated = await res.json()
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_sold_out: updated.is_sold_out } : p)),
      )
    } else {
      alert('更新に失敗しました')
    }

    setUpdating(null)
  }

  const toggleOption = async (key: OptionKey) => {
    if (updating) return
    setUpdating(`option-${key}`)
    const res = await fetch(`/api/admin/options/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_sold_out: !optionSoldOut[key] }),
    })
    if (res.ok) {
      const updated: { key: OptionKey; is_sold_out: boolean } = await res.json()
      setOptionSoldOut((prev) => ({ ...prev, [updated.key]: updated.is_sold_out }))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? '更新に失敗しました')
    }
    setUpdating(null)
  }

  /** おにぎりをまとめて売り切れ／販売中にする */
  const bulkNigiri = async (isSoldOut: boolean) => {
    if (updating) return
    const message = isSoldOut
      ? 'おにぎりをすべて「売り切れ」にします。よろしいですか？'
      : 'おにぎりをすべて「販売中」に戻します。よろしいですか？'
    if (!window.confirm(message)) return

    setUpdating('bulk')
    const res = await fetch('/api/admin/products/bulk-sold-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_sold_out: isSoldOut }),
    })
    if (res.ok) {
      await fetchAll()
    } else {
      alert('更新に失敗しました')
    }
    setUpdating(null)
  }

  const nigiri = products.filter((p) => p.category === NIGIRI_CATEGORY)
  const others = products.filter((p) => p.category !== NIGIRI_CATEGORY)

  // 入力欄があるため、コンポーネントではなく関数で描画する（入力中に欄が作り直されないように）

  /** 仕込み数の入力欄と、注文数・残り数 */
  const renderPrepInput = (stockKey: StockKey) => {
    const st = stock.get(stockKey)
    const draft = drafts.get(stockKey)
    const inputValue = draft ?? (st ? String(st.prepared_qty) : '')
    const inputId = `prep-${stockKey}`
    const remainingClass =
      st == null
        ? ''
        : st.remaining <= 0
          ? 'text-red-600'
          : st.remaining <= LOW_STOCK_THRESHOLD
            ? 'text-amber-600'
            : 'text-green-700'

    return (
      <div className="flex items-center gap-2 text-sm">
        <label className="text-brown-500 whitespace-nowrap" htmlFor={inputId}>
          仕込み数
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={0}
          value={inputValue}
          placeholder="未入力"
          onChange={(e) => setDrafts((prev) => new Map(prev).set(stockKey, e.target.value))}
          onBlur={() => savePrepared(stockKey)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          disabled={updating === `stock-${stockKey}`}
          className="w-20 rounded-lg border border-cream-300 bg-white px-2 py-1 text-right tabular-nums"
        />
        <span className="text-brown-400">個</span>
        {st && (
          <span className={`ml-auto font-bold tabular-nums ${remainingClass}`}>
            注文 {st.ordered_qty}・残り {Math.max(0, st.remaining)}
          </span>
        )}
      </div>
    )
  }

  const renderProductRow = (product: Product) => {
    return (
      <div key={product.id} className={`card p-3 space-y-2 ${product.is_sold_out ? 'opacity-70' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-cream-200 flex-shrink-0">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                width={56}
                height={56}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🍙</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base text-brown-800 truncate">{product.name}</p>
            <p className="text-brown-500 text-sm">¥{product.price.toLocaleString()}</p>
          </div>
          <SoldOutButton
            soldOut={product.is_sold_out}
            busy={updating === product.id}
            onClick={() => toggleSoldOut(product)}
          />
        </div>
        {isLunchPlate(product) ? (
          <p className="text-xs text-brown-400">仕込み数は「ランチプレート（1個・2個の合計）」で入力します</p>
        ) : (
          renderPrepInput(productStockKey(product.id))
        )}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="section-title">売り切れ</h1>
          <p className="text-sm text-brown-400">毎日0時にすべて販売中に戻ります</p>
        </div>
        <div className="card p-3 text-sm text-brown-600 space-y-2">
          <p>
            <span className="font-bold">仕込み数</span>
            を入れた商品は、注文された数から残りを計算し、0になると自動で売り切れになります。空欄にすると数を管理しません。
            テイクアウトは受け取り日の分として数えます。
          </p>
          <div className="flex gap-2">
            {([0, 1] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setStockDay(d)}
                className={`px-3 py-1 rounded-lg text-sm font-bold border ${
                  stockDay === d
                    ? 'bg-brown-600 text-white border-brown-600'
                    : 'bg-white text-brown-600 border-cream-300'
                }`}
              >
                {d === 0 ? '今日の仕込み数' : '明日の仕込み数'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="text-5xl animate-bounce">🍙</div>
        </div>
      ) : (
        <>
          {/* おにぎり */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-bold text-lg text-brown-800">おにぎり</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => bulkNigiri(true)}
                  disabled={updating !== null}
                  className="px-3 py-2 rounded-xl text-sm font-bold border bg-red-100 text-red-700 border-red-300 hover:bg-red-200 disabled:opacity-50"
                >
                  {updating === 'bulk' ? '更新中...' : 'すべて売り切れにする'}
                </button>
                <button
                  type="button"
                  onClick={() => bulkNigiri(false)}
                  disabled={updating !== null}
                  className="px-3 py-2 rounded-xl text-sm font-bold border bg-green-100 text-green-700 border-green-300 hover:bg-green-200 disabled:opacity-50"
                >
                  すべて販売中に戻す
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {nigiri.map(renderProductRow)}
            </div>
          </section>

          {/* オプション */}
          <section className="space-y-3">
            <div>
              <h2 className="font-bold text-lg text-brown-800">オプション</h2>
              <p className="text-xs text-brown-400">
                売り切れにすると、すべてのおにぎりで選べなくなります
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(OPTION_NAMES) as OptionKey[]).map((key) => (
                <div key={key} className={`card p-3 space-y-2 ${optionSoldOut[key] ? 'opacity-70' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base text-brown-800">{OPTION_NAMES[key]}</p>
                      <p className="text-brown-500 text-sm">+¥{OPTION_PRICES[key].toLocaleString()}</p>
                    </div>
                    <SoldOutButton
                      soldOut={optionSoldOut[key]}
                      busy={updating === `option-${key}`}
                      onClick={() => toggleOption(key)}
                    />
                  </div>
                  {/* 数に限りがある漬け卵黄だけ、仕込み数を入れられる */}
                  {key === 'egg_yolk' && renderPrepInput(optionStockKey(key))}
                </div>
              ))}
            </div>
          </section>

          {/* その他の商品 */}
          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-bold text-lg text-brown-800">ランチプレート・サイドほか</h2>
              {others.some(isLunchPlate) && (
                <div className="card p-3 space-y-2 border-2 border-amber-200">
                  <div>
                    <p className="font-bold text-base text-brown-800">ランチプレート（1個・2個の合計）</p>
                    <p className="text-xs text-brown-400">
                      1個用・2個用の注文を合わせて数え、残りが0になると両方とも売り切れになります
                    </p>
                  </div>
                  {renderPrepInput(LUNCH_PLATE_STOCK_KEY)}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {others.map(renderProductRow)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
