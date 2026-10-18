'use client'

import { useRef, useState } from 'react'
import type { CartItem, Product, LunchNigiriUnit, NigiriOptions, OptionSoldOut } from '@/lib/types'
import {
  calcCartTotal,
  isToppingSelectable,
  optionLabel,
  optionPrice,
  getLunchPlateSurcharge,
  lunchPlateNigiriCount,
} from '@/lib/types'
import RecommendPopup, { shouldShowRecommend } from '@/components/customer/RecommendPopup'
import DinerSplitPopup, { type DinerAssignment } from '@/components/customer/DinerSplitPopup'
import LunchPlateSelector from '@/components/customer/LunchPlateSelector'

interface Props {
  items: CartItem[]
  /** 注文を確定する（注文者ごとに分けた場合はその割り当てを渡す） */
  onSubmit: (assignment?: DinerAssignment) => Promise<void>
  /** 来店人数。2名以上でおにぎりが2個以上なら、確定の直前に注文者ごとに分けてもらう */
  partySize?: number | null
  isSubmitting: boolean
  /** ランチプレート選択UI用 */
  allProducts?: Product[]
  /** ランチプレート1枚ごとのおにぎり選択（配列長 = ランチプレート枚数） */
  lunchNigiriPerPlate?: LunchNigiriUnit[][]
  /** カート内のランチプレートを1枚ずつに展開したもの（lunchNigiriPerPlate と同じ順序） */
  lunchPlateEntries?: Product[]
  onLunchNigiriChange?: (index: number, next: LunchNigiriUnit[]) => void
  /** カートの個数変更（delta: +1 / -1） */
  onQuantityChange?: (item: CartItem, delta: number) => void
  /** カートから商品を削除 */
  onItemDelete?: (item: CartItem) => void
  /** とろろ昆布・漬け卵黄の売り切れ状態（ランチプレートのおにぎり選択に使う） */
  optionSoldOut?: OptionSoldOut
  /** 商品をカートに追加（豚汁おすすめ用） */
  onAddItem?: (product: Product) => void
  /** おすすめする豚汁商品（渡された場合のみポップアップ表示） */
  tonjiruProduct?: Product
  /** おにぎりのトッピングのおすすめで、カートの行のオプションを変える */
  onOptionsChange?: (item: CartItem, options: NigiriOptions) => void
}

export default function Cart({
  items,
  onSubmit,
  isSubmitting,
  partySize,
  allProducts = [],
  lunchNigiriPerPlate = [],
  lunchPlateEntries = [],
  onLunchNigiriChange,
  onQuantityChange,
  onItemDelete,
  optionSoldOut,
  onAddItem,
  tonjiruProduct,
  onOptionsChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [showRecommend, setShowRecommend] = useState(false)
  const [showDinerSplit, setShowDinerSplit] = useState(false)
  /** 最後におすすめを出したときのカートの中身（同じ中身なら2回目は出さない） */
  const recommendedFor = useRef<string | null>(null)

  const hasTonjiru = tonjiruProduct
    ? items.some((i) => i.product.id === tonjiruProduct.id)
    : true
  /** 豚汁をおすすめするか（カートになく、ランチプレートもないとき） */
  const recommendTonjiru = tonjiruProduct && !hasTonjiru && lunchNigiriPerPlate.length === 0 ? tonjiruProduct : undefined

  // おにぎりの中身だけで比べる（豚汁を足しただけで、もう一度出さないように）
  const cartSignature = () =>
    items
      .filter((i) => isToppingSelectable(i.product))
      .map((i) => `${i.product.id}:${i.quantity}:${i.with_topping}:${!!i.with_egg_yolk}:${!!i.with_large}:${!!i.is_takeout}`)
      .join('|')

  /** カートを開く前に、豚汁・おにぎりのトッピングのおすすめを出す（出すものがなければそのまま開く） */
  function handleCartOpen() {
    if (
      cartSignature() !== recommendedFor.current &&
      shouldShowRecommend(items, recommendTonjiru, optionSoldOut, !!onOptionsChange)
    ) {
      setShowRecommend(true)
    } else {
      setIsOpen(true)
    }
  }

  const baseTotal = calcCartTotal(items)
  // ランチプレート追加分: おにぎりの種類別加算 + とろろ昆布変更 +50円
  // （おにぎりの個数分の料金は商品価格そのものに含まれる）
  const lunchSurcharge = lunchNigiriPerPlate.flatMap((units) =>
    units.map((unit) => {
      const product = allProducts.find((p) => p.id === unit.productId)
      const surcharge = product ? getLunchPlateSurcharge(product) : 0
      return surcharge + optionPrice({ with_topping: unit.tororo, with_egg_yolk: unit.eggYolk, with_large: unit.large })
    })
  ).reduce((s, v) => s + v, 0)
  const total = baseTotal + lunchSurcharge

  const totalCount = items.reduce((s, i) => s + i.quantity, 0)

  /** i枚目のプレートで選ぶおにぎりの個数 */
  const requiredNigiri = (i: number) => {
    const plate = lunchPlateEntries[i]
    return plate ? lunchPlateNigiriCount(plate) : 1
  }

  const lunchPlateCount = lunchNigiriPerPlate.length
  const lunchPlateReady =
    lunchPlateCount === 0 ||
    lunchNigiriPerPlate.every((units, i) => units.length === requiredNigiri(i))


  const eatinCartItems = items.filter((item) => !item.is_takeout)
  /** 注文者ごとに分ける対象（店内で食べるおにぎり。ランチプレートの中のおにぎりはプレートで分かれるので含めない） */
  const dinerSplitItems = eatinCartItems.filter((item) => isToppingSelectable(item.product))
  const needsDinerSplit =
    (partySize ?? 0) >= 2 && dinerSplitItems.reduce((sum, item) => sum + item.quantity, 0) >= 2
  const takeoutCartItems = items.filter((item) => item.is_takeout)

  /** カート1行分（店内分・お持ち帰り分で共通） */
  const renderCartItem = (item: CartItem) => {
    const toppingCost = optionPrice(item)
    const subtotal = (item.product.price + toppingCost) * item.quantity
    const options = optionLabel(item)

    return (
      <div
        key={`${item.product.id}-${item.with_topping}-${!!item.with_egg_yolk}-${!!item.with_large}-${item.timing ?? ''}-${item.is_takeout ? 'takeout' : ''}`}
        className="space-y-1.5"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base text-brown-800">
              {item.product.name}
              {options && (
                <span className="ml-1 text-sm text-brown-500 font-normal">
                  （{options}）
                </span>
              )}
            </p>
            <p className="text-sm text-brown-500">
              ¥{(item.product.price + toppingCost).toLocaleString()} × {item.quantity}
            </p>
          </div>
          <p className="font-bold text-brown-700 tabular-nums whitespace-nowrap">
            ¥{subtotal.toLocaleString()}
          </p>
        </div>

        {/* 個数変更・削除 */}
        {(onQuantityChange || onItemDelete) && (
          <div className="flex items-center justify-between gap-2">
            {onQuantityChange && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onQuantityChange(item, -1)}
                  aria-label="1つ減らす"
                  className="w-8 h-8 rounded-full border border-brown-400 text-brown-600 font-bold text-xl leading-none flex items-center justify-center active:bg-brown-100"
                >
                  −
                </button>
                <span className="w-5 text-center font-bold text-brown-800 tabular-nums">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(item, 1)}
                  aria-label="1つ増やす"
                  className="w-8 h-8 rounded-full border border-brown-400 text-brown-600 font-bold text-xl leading-none flex items-center justify-center active:bg-brown-100"
                >
                  ＋
                </button>
              </div>
            )}
            {onItemDelete && (
              <button
                type="button"
                onClick={() => onItemDelete(item)}
                className="text-xs text-brown-400 underline underline-offset-2 px-1 py-1"
              >
                削除
              </button>
            )}
          </div>
        )}

      </div>
    )
  }

  if (totalCount === 0) return null

  return (
    <>
      {/* カートバー（下部固定） */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-brown-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <button
            onClick={handleCartOpen}
            className="flex items-center gap-3 flex-1"
          >
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{totalCount}</span>
            </div>
            <span className="font-bold text-lg">カートを見る</span>
            {lunchPlateCount > 0 && !lunchPlateReady && (
              <span className="text-xs bg-amber-400 text-brown-900 px-2 py-0.5 rounded-full font-semibold">
                選択が必要です
              </span>
            )}
          </button>
          <span className="font-bold text-xl tabular-nums">
            ¥{total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* おすすめ（豚汁・おにぎりのトッピング） */}
      {showRecommend && (
        <RecommendPopup
          items={items}
          tonjiruProduct={recommendTonjiru}
          onAddTonjiru={onAddItem}
          optionSoldOut={optionSoldOut}
          onOptionsChange={onOptionsChange}
          onNext={() => {
            recommendedFor.current = cartSignature()
            setShowRecommend(false)
            setIsOpen(true)
          }}
          onClose={() => {
            recommendedFor.current = cartSignature()
            setShowRecommend(false)
          }}
        />
      )}

      {/* カートドロワー */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />

          <div className="relative bg-cream-50 rounded-t-3xl max-h-[85dvh] flex flex-col shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-brown-300 rounded-full" />
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-cream-300">
              <h2 className="section-title text-xl">ご注文内容</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-brown-400 text-3xl leading-none p-1"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
              {eatinCartItems.map(renderCartItem)}

              {/* ランチプレート おにぎり選択（プレート別） */}
              {lunchPlateCount > 0 && onLunchNigiriChange &&
                lunchNigiriPerPlate.map((units, i) => (
                  <LunchPlateSelector
                    key={i}
                    products={allProducts}
                    units={units}
                    required={requiredNigiri(i)}
                    optionSoldOut={optionSoldOut}
                    plateLabel={lunchPlateCount > 1 ? `${i + 1}枚目` : undefined}
                    onChange={(next) => onLunchNigiriChange(i, next)}
                  />
                ))
              }

              {/* 店内のご注文と一緒に頼んだお持ち帰り分 */}
              {takeoutCartItems.length > 0 && (
                <div className="pt-3 border-t border-dashed border-amber-300 space-y-3">
                  <p className="text-sm font-bold text-amber-700">お持ち帰り（お会計時にお渡し）</p>
                  {takeoutCartItems.map(renderCartItem)}
                </div>
              )}
            </div>

            <div className="px-4 py-4 border-t border-cream-300 space-y-3">
              {lunchSurcharge > 0 && (
                <div className="flex justify-between items-center text-sm text-amber-700">
                  <span>ランチプレート追加料金</span>
                  <span className="tabular-nums">+¥{lunchSurcharge.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-brown-800">合計</span>
                <span className="text-2xl font-bold text-brown-700 tabular-nums">
                  ¥{total.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-brown-400 text-center">
                ※ お会計はレジにて対面でお願いします
              </p>
              {lunchPlateCount > 0 && !lunchPlateReady && (
                <p className="text-center text-sm text-amber-700 font-medium">
                  ランチプレートのおにぎりを選んでから注文できます
                </p>
              )}
              <button
                onClick={async () => {
                  if (needsDinerSplit) {
                    setShowDinerSplit(true)
                    return
                  }
                  await onSubmit()
                  setIsOpen(false)
                }}
                disabled={isSubmitting || !lunchPlateReady}
                className="btn-primary w-full text-xl py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '送信中...' : '注文を確定する'}
              </button>
            </div>

            <div className="pb-safe" />
          </div>
        </div>
      )}

      {/* 確定の直前に、おにぎりを注文者ごとに分ける */}
      {showDinerSplit && partySize && (
        <DinerSplitPopup
          items={dinerSplitItems}
          partySize={partySize}
          isSubmitting={isSubmitting}
          onConfirm={async (assignment) => {
            await onSubmit(assignment)
            setShowDinerSplit(false)
            setIsOpen(false)
          }}
          onCancel={() => setShowDinerSplit(false)}
        />
      )}
    </>
  )
}
