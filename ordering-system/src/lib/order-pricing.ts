import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getLunchPlateSurcharge,
  isLunchPlate,
  isToppingSelectable,
  lunchPlateNigiriCount,
  type Product,
} from '@/lib/types'

/** 1行で注文できる最大の個数 */
const MAX_QUANTITY = 99

interface PricedInput {
  product_id: string
  quantity: number
  lunch_plate_index?: number | null
}

/**
 * お客様の画面から届いた明細の値段・商品名を、データベースの商品で付け直す
 * （画面から届いた値段はそのまま使わない。書き換えられても正しい値段で記録するため）
 * - ランチプレートの中のおにぎり: 種類ごとの追加料金（getLunchPlateSurcharge）
 * - それ以外: 商品の値段
 * 個数がおかしい・商品がない・プレートにないおにぎりがある場合は、エラーの文を返す
 */
export async function priceOrderItems<T extends PricedInput>(
  supabase: SupabaseClient,
  items: T[],
): Promise<{ items: (T & { unit_price: number; product_name: string })[] } | { error: string }> {
  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > MAX_QUANTITY)) {
    return { error: '個数が正しくありません' }
  }

  const ids = [...new Set(items.map((i) => i.product_id))]
  const { data, error } = await supabase.from('products').select('*').in('id', ids)
  if (error) return { error: error.message }
  const products = new Map(((data ?? []) as Product[]).map((p) => [p.id, p]))
  if (ids.some((id) => !products.has(id))) return { error: '見つからない商品があります。画面を開き直してください' }

  // ランチプレートの中のおにぎりは、注文したプレートに入る数までしか受け付けない（追加料金だけで単品を頼めないように）
  let plateSlots = 0
  let plateNigiri = 0
  for (const item of items) {
    const product = products.get(item.product_id)!
    if (item.lunch_plate_index != null) {
      if (!isToppingSelectable(product)) return { error: 'ランチプレートにはおにぎりを選んでください' }
      plateNigiri += item.quantity
    } else if (isLunchPlate(product)) {
      plateSlots += item.quantity * lunchPlateNigiriCount(product)
    }
  }
  if (plateNigiri > plateSlots) return { error: 'ランチプレートのおにぎりの数が正しくありません' }

  return {
    items: items.map((item) => {
      const product = products.get(item.product_id)!
      return {
        ...item,
        product_name: product.name,
        unit_price: item.lunch_plate_index != null ? getLunchPlateSurcharge(product) : product.price,
      }
    }),
  }
}
