'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Order, OrderItem, Product } from '@/lib/types'
import {
  EGG_YOLK_CART_LABEL,
  EGG_YOLK_PRICE,
  TAKEOUT_TABLE_ID,
  TOPPING_CART_LABEL,
  TOPPING_PRICE,
  getOrderBatchIndexes,
  groupLunchPlateNigiri,
  isLunchPlate,
  isToppingSelectable,
  optionLabel,
  orderBatchLabel,
} from '@/lib/types'

interface Props {
  order: Order
  /** 修正したあとに注文を読み直す */
  onChanged: () => Promise<void> | void
}

/** API を呼び、失敗したらメッセージを出す。成功したら true */
async function callApi(url: string, method: string, body?: unknown): Promise<boolean> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.ok) return true
  const data = await res.json().catch(() => ({}))
  alert(data.error ?? '修正に失敗しました')
  return false
}

/**
 * 注文内容の修正（店員用）
 * お客様の注文ミスに対応するため、明細の個数・オプション・ランチプレートのおにぎりを変えたり、
 * 明細を削除・追加したりできる。仕込み数を入れている商品は残り数も合わせて変わる。
 */
export default function OrderEditPanel({ order, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])

  // 追加する商品の入力
  const [addProductId, setAddProductId] = useState('')
  const [addQty, setAddQty] = useState(1)
  const [addTororo, setAddTororo] = useState(false)
  const [addEggYolk, setAddEggYolk] = useState(false)
  const [addTakeout, setAddTakeout] = useState(false)

  useEffect(() => {
    if (!open || products.length > 0) return
    fetch('/api/products')
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(data))
      .catch(() => {})
  }, [open, products.length])

  const items = useMemo(
    () => [...(order.order_items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [order.order_items],
  )
  const batches = getOrderBatchIndexes(items)
  const plateGroups = groupLunchPlateNigiri(items)
  /** ランチプレートの中のおにぎり → 何枚目のプレートか */
  const nigiriPlate = new Map<string, string>()
  for (const [plateId, groups] of plateGroups) {
    const plate = items.find((i) => i.id === plateId)
    groups.forEach((g, gi) =>
      g.forEach((n) =>
        nigiriPlate.set(n.id, `${plate?.product?.name ?? 'ランチプレート'}${groups.length > 1 ? ` ${gi + 1}枚目` : ''}`),
      ),
    )
  }

  const onigiri = products.filter(isToppingSelectable)
  const addable = products.filter((p) => !isLunchPlate(p))
  const addProduct = addable.find((p) => p.id === addProductId)
  const isEatin = order.table_id !== TAKEOUT_TABLE_ID

  const run = async (key: string, fn: () => Promise<boolean>) => {
    if (busy) return
    setBusy(key)
    const ok = await fn()
    if (ok) await onChanged()
    setBusy(null)
  }

  const patchItem = (item: OrderItem, body: Record<string, unknown>) =>
    run(item.id, () => callApi(`/api/admin/order-items/${item.id}`, 'PATCH', body))

  const deleteItem = (item: OrderItem) => {
    const plateNigiri = (plateGroups.get(item.id) ?? []).flat()
    const message = plateNigiri.length
      ? `「${item.product?.name}」と中のおにぎりを削除しますか？`
      : `「${item.product?.name ?? 'この商品'}」を削除しますか？`
    if (!window.confirm(message)) return
    run(item.id, async () => {
      for (const n of plateNigiri) {
        if (!(await callApi(`/api/admin/order-items/${n.id}`, 'DELETE'))) return false
      }
      return callApi(`/api/admin/order-items/${item.id}`, 'DELETE')
    })
  }

  const addItem = () => {
    if (!addProduct) return
    const withOptions = isToppingSelectable(addProduct)
    run('add', async () => {
      const ok = await callApi(`/api/admin/orders/${order.id}/items`, 'POST', {
        product_id: addProduct.id,
        quantity: addQty,
        with_topping: withOptions && addTororo,
        with_egg_yolk: withOptions && addEggYolk,
        is_takeout: isEatin && addTakeout,
      })
      if (ok) {
        setAddProductId('')
        setAddQty(1)
        setAddTororo(false)
        setAddEggYolk(false)
        setAddTakeout(false)
      }
      return ok
    })
  }

  const OptionToggles = ({ item }: { item: OrderItem }) => (
    <div className="flex flex-wrap gap-3 text-xs text-brown-600">
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={item.with_topping}
          disabled={busy !== null}
          onChange={(e) => patchItem(item, { with_topping: e.target.checked })}
          className="w-4 h-4 accent-brown-600"
        />
        {TOPPING_CART_LABEL}（+¥{TOPPING_PRICE}）
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={!!item.with_egg_yolk}
          disabled={busy !== null}
          onChange={(e) => patchItem(item, { with_egg_yolk: e.target.checked })}
          className="w-4 h-4 accent-brown-600"
        />
        {EGG_YOLK_CART_LABEL}（+¥{EGG_YOLK_PRICE}）
      </label>
    </div>
  )

  const smallButton =
    'px-3 py-1 rounded-lg text-sm font-bold border border-cream-300 bg-white text-brown-700 disabled:opacity-40'

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mb-4 py-3 rounded-xl border-2 border-dashed border-brown-300 text-brown-600 font-bold"
      >
        注文内容を修正する
      </button>
    )
  }

  return (
    <div className="card p-4 mb-4 space-y-4 border-2 border-brown-300">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg text-brown-700">注文内容の修正</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-brown-500 underline">
          閉じる
        </button>
      </div>
      <p className="text-xs text-brown-400">
        変更はすぐに反映されます。LINEで送った確認メッセージは送り直されません。
      </p>

      <div className="divide-y divide-cream-200">
        {items.map((item) => {
          const isNigiriInPlate = item.lunch_plate_index != null
          const isPlate = item.product != null && isLunchPlate(item.product)
          const canOptions = item.product != null && isToppingSelectable(item.product)
          const batchLabel = orderBatchLabel(batches.get(item.id) ?? 0)
          const options = optionLabel(item)
          const rowBusy = busy === item.id

          return (
            <div key={item.id} className={`py-3 space-y-2 ${rowBusy ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-brown-800">
                    {batchLabel && <span className="text-rose-600 mr-1">［{batchLabel}］</span>}
                    {item.is_takeout && <span className="text-amber-700 mr-1">［お持ち帰り］</span>}
                    {item.product?.name ?? '不明'}
                    {!isNigiriInPlate && <span className="text-brown-400 ml-1">×{item.quantity}</span>}
                  </p>
                  {isNigiriInPlate && (
                    <p className="text-xs text-brown-400">{nigiriPlate.get(item.id) ?? 'ランチプレート'}のおにぎり</p>
                  )}
                  {options && <p className="text-xs text-brown-400">（{options}）</p>}
                </div>
                <button
                  type="button"
                  onClick={() => deleteItem(item)}
                  disabled={busy !== null}
                  className="px-3 py-1 rounded-lg text-sm font-bold border border-red-300 bg-red-50 text-red-700 disabled:opacity-40 flex-shrink-0"
                >
                  削除
                </button>
              </div>

              {/* ランチプレートのおにぎりは、別のおにぎりに入れ替えられる */}
              {isNigiriInPlate && onigiri.length > 0 && (
                <select
                  value={item.product_id}
                  disabled={busy !== null}
                  onChange={(e) => patchItem(item, { product_id: e.target.value })}
                  className="w-full rounded-lg border border-cream-300 bg-white px-2 py-1 text-sm"
                >
                  {onigiri.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              {/* ランチプレート以外は個数を変えられる */}
              {!isNigiriInPlate && !isPlate && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={smallButton}
                    disabled={busy !== null || item.quantity <= 1}
                    onClick={() => patchItem(item, { quantity: item.quantity - 1 })}
                    aria-label="1つ減らす"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold tabular-nums">{item.quantity}</span>
                  <button
                    type="button"
                    className={smallButton}
                    disabled={busy !== null}
                    onClick={() => patchItem(item, { quantity: item.quantity + 1 })}
                    aria-label="1つ増やす"
                  >
                    ＋
                  </button>
                </div>
              )}

              {canOptions && !isPlate && <OptionToggles item={item} />}
              {isPlate && (
                <p className="text-xs text-brown-400">
                  ランチプレートは削除のみできます（中のおにぎりは上の各行で入れ替えられます）
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* 商品の追加 */}
      <div className="border-t border-cream-300 pt-4 space-y-3">
        <p className="font-bold text-brown-700">商品を追加</p>
        <select
          value={addProductId}
          onChange={(e) => setAddProductId(e.target.value)}
          className="w-full rounded-lg border border-cream-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">商品を選んでください</option>
          {addable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（¥{p.price.toLocaleString()}）{p.is_sold_out ? ' 売り切れ' : ''}
            </option>
          ))}
        </select>

        {addProduct && (
          <div className="space-y-3">
            {isToppingSelectable(addProduct) && (
              <div className="flex flex-wrap gap-3 text-sm text-brown-600">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={addTororo}
                    onChange={(e) => setAddTororo(e.target.checked)}
                    className="w-4 h-4 accent-brown-600"
                  />
                  {TOPPING_CART_LABEL}（+¥{TOPPING_PRICE}）
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={addEggYolk}
                    onChange={(e) => setAddEggYolk(e.target.checked)}
                    className="w-4 h-4 accent-brown-600"
                  />
                  {EGG_YOLK_CART_LABEL}（+¥{EGG_YOLK_PRICE}）
                </label>
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={smallButton}
                  disabled={addQty <= 1}
                  onClick={() => setAddQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span className="w-6 text-center font-bold tabular-nums">{addQty}</span>
                <button type="button" className={smallButton} onClick={() => setAddQty((q) => q + 1)}>
                  ＋
                </button>
              </div>
              {isEatin && (
                <label className="flex items-center gap-1 text-sm text-brown-600">
                  <input
                    type="checkbox"
                    checked={addTakeout}
                    onChange={(e) => setAddTakeout(e.target.checked)}
                    className="w-4 h-4 accent-brown-600"
                  />
                  お持ち帰り
                </label>
              )}
              <button
                type="button"
                onClick={addItem}
                disabled={busy !== null}
                className="btn-primary px-4 py-2 text-sm ml-auto disabled:opacity-50"
              >
                {busy === 'add' ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
