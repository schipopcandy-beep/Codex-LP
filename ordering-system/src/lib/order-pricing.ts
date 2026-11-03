import type { SupabaseClient } from '@supabase/supabase-js'
import { getSetSurcharge, isNigiriSet, isToppingSelectable, setNigiriCount, type Product } from '@/lib/types'

/** 1行で注文できる最大の個数 */
const MAX_QUANTITY = 99

interface PricedInput {
  product_id: string
  quantity: number
  /** ランチプレート・お弁当の中のおにぎりなら、何番目のランチプレート・お弁当に入るか */
  lunch_plate_index?: number | null
  /**
   * ランチプレート・お弁当の行が何番目か（中のおにぎりの lunch_plate_index と対応させる。記録はしない）
   * 送られてこないときは、ランチプレート・お弁当の行の並び順（0から）とみなす
   */
  container_index?: number | null
}

/**
 * お客様の画面から届いた明細の値段・商品名を、データベースの商品で付け直す
 * （画面から届いた値段はそのまま使わない。書き換えられても正しい値段で記録するため）
 * - ランチプレート・お弁当の中のおにぎり: 入れ物ごとの追加料金（getSetSurcharge）
 * - それ以外: 商品の値段
 * 個数がおかしい・商品がない・入れ物にないおにぎりがある場合は、エラーの文を返す
 */
export async function priceOrderItems<T extends PricedInput>(
  supabase: SupabaseClient,
  items: T[],
): Promise<
  | {
      items: (T & {
        unit_price: number
        product_name: string
        product_category: string
        product_sold_out: boolean
        product_paused: boolean
        product_paused_until: string | null
      })[]
    }
  | { error: string }
> {
  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > MAX_QUANTITY)) {
    return { error: '個数が正しくありません' }
  }

  const ids = [...new Set(items.map((i) => i.product_id))]
  const { data, error } = await supabase.from('products').select('*').in('id', ids)
  if (error) return { error: error.message }
  const products = new Map(((data ?? []) as Product[]).map((p) => [p.id, p]))
  if (ids.some((id) => !products.has(id))) return { error: '見つからない商品があります。画面を開き直してください' }

  // 何番目の入れ物（ランチプレート・お弁当）が何の商品か
  const containers = new Map<number, Product>()
  let nextIndex = 0
  for (const item of items) {
    const product = products.get(item.product_id)!
    if (item.lunch_plate_index != null || !isNigiriSet(product)) continue
    if (item.container_index != null) {
      if (item.quantity !== 1) return { error: 'ランチプレート・お弁当の数が正しくありません' }
      containers.set(item.container_index, product)
    } else {
      for (let k = 0; k < item.quantity; k++) containers.set(nextIndex++, product)
    }
  }

  // 中のおにぎりは、注文した入れ物に入る数までしか受け付けない（追加料金だけで単品を頼めないように）
  const filled = new Map<number, number>()
  for (const item of items) {
    if (item.lunch_plate_index == null) continue
    const container = containers.get(item.lunch_plate_index)
    if (!container) return { error: 'ランチプレート・お弁当のおにぎりの数が正しくありません' }
    if (!isToppingSelectable(products.get(item.product_id)!)) {
      return { error: 'ランチプレート・お弁当にはおにぎりを選んでください' }
    }
    const count = (filled.get(item.lunch_plate_index) ?? 0) + item.quantity
    if (count > setNigiriCount(container)) return { error: 'ランチプレート・お弁当のおにぎりの数が正しくありません' }
    filled.set(item.lunch_plate_index, count)
  }

  return {
    items: items.map((item) => {
      const product = products.get(item.product_id)!
      const container = item.lunch_plate_index != null ? containers.get(item.lunch_plate_index)! : null
      return {
        ...item,
        product_name: product.name,
        product_category: product.category,
        /** 今日の分が売り切れか（管理画面の売り切れ設定・仕込み数を使い切った自動の売り切れ） */
        product_sold_out: product.is_sold_out,
        /** 販売休止（isPausedOn で、受け取り日・注文日に休止中か確かめる） */
        product_paused: !!product.paused,
        product_paused_until: product.paused_until ?? null,
        unit_price: container ? getSetSurcharge(container, product) : product.price,
      }
    }),
  }
}
