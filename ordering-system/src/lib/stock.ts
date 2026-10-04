import type { SupabaseClient } from '@supabase/supabase-js'
import { TAKEOUT_TABLE_ID } from '@/lib/types'
import { addDays, todayJST } from '@/lib/business-hours'

/** 残りがこの数以下になったら「残りわずか」として知らせる */
export const LOW_STOCK_THRESHOLD = 5

/** 商品1つ分の仕込み数と残り数 */
export interface StockStatus {
  product_id: string
  product_name: string
  prepared_qty: number
  ordered_qty: number
  remaining: number
}

/** 日本時間の YYYY-MM-DD の 0:00〜24:00 を UTC の範囲で返す */
function utcRangeOf(date: string): { start: string; end: string } {
  const toUtc = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString()
  return { start: toUtc(date), end: toUtc(addDays(date, 1)) }
}

/**
 * その日に使う分として注文された数（商品ごと）
 * - 店内注文（席から頼んだお持ち帰りを含む）: 注文した日
 * - テイクアウト: 受け取り日（受け取り日がなければ注文した日）
 * ランチプレートの中で選んだおにぎりも、そのおにぎりの数に含める。
 */
export async function getOrderedCounts(
  supabase: SupabaseClient,
  date: string,
): Promise<Map<string, number>> {
  const { start, end } = utcRangeOf(date)
  const select = 'id, order_items(product_id, quantity)'

  const [eatin, takeoutByPickup, takeoutNoPickup] = await Promise.all([
    supabase.from('orders').select(select).neq('table_id', TAKEOUT_TABLE_ID).gte('created_at', start).lt('created_at', end),
    supabase.from('orders').select(select).eq('table_id', TAKEOUT_TABLE_ID).like('pickup_at', `${date}%`),
    supabase
      .from('orders')
      .select(select)
      .eq('table_id', TAKEOUT_TABLE_ID)
      .is('pickup_at', null)
      .gte('created_at', start)
      .lt('created_at', end),
  ])

  const counts = new Map<string, number>()
  for (const res of [eatin, takeoutByPickup, takeoutNoPickup]) {
    for (const order of (res.data ?? []) as { order_items?: { product_id: string; quantity: number }[] }[]) {
      for (const item of order.order_items ?? []) {
        counts.set(item.product_id, (counts.get(item.product_id) ?? 0) + item.quantity)
      }
    }
  }
  return counts
}

/**
 * 仕込み数を入れている商品の残り数
 * 表がまだない（SQL未実行）場合は空（＝どの商品も数を管理していない）
 */
export async function getStockStatus(supabase: SupabaseClient, date: string): Promise<StockStatus[]> {
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, prepared_qty, products(name)')
    .eq('date', date)
  if (error || !data || data.length === 0) return []

  const ordered = await getOrderedCounts(supabase, date)
  return (data as unknown as { product_id: string; prepared_qty: number; products: { name: string } | null }[]).map(
    (row) => {
      const orderedQty = ordered.get(row.product_id) ?? 0
      return {
        product_id: row.product_id,
        product_name: row.products?.name ?? '不明',
        prepared_qty: row.prepared_qty,
        ordered_qty: orderedQty,
        remaining: row.prepared_qty - orderedQty,
      }
    },
  )
}

/**
 * これから注文する数が残り数を超えないか確認する
 * 足りない商品があれば、お客様に見せるメッセージを返す（なければ null）
 */
export async function checkStock(
  supabase: SupabaseClient,
  date: string,
  requested: Map<string, number>,
): Promise<string | null> {
  const statuses = await getStockStatus(supabase, date)
  const shortages = statuses.filter((s) => (requested.get(s.product_id) ?? 0) > Math.max(0, s.remaining))
  if (shortages.length === 0) return null

  const detail = shortages
    .map((s) => (s.remaining > 0 ? `「${s.product_name}」は残り${s.remaining}個` : `「${s.product_name}」は売り切れ`))
    .join('、')
  return `申し訳ありません。${detail}です。数を減らしてもう一度ご注文ください。`
}

/**
 * 残り数に合わせて、今日の売り切れ表示を自動で切り替える
 * - 残りが0以下になった商品 → 売り切れにする（自動で売り切れにした印を残す）
 * - 注文の修正などで残りが戻った商品 → 自動で売り切れにしたものだけ販売中に戻す
 * 売り切れの表示は「今日」の状態なので、今日の分だけを対象にする。
 */
export async function syncAutoSoldOut(supabase: SupabaseClient, date: string = todayJST()): Promise<void> {
  if (date !== todayJST()) return

  const statuses = await getStockStatus(supabase, date)
  if (statuses.length === 0) return

  const { data: rows } = await supabase
    .from('product_stock')
    .select('product_id, auto_sold_out')
    .eq('date', date)
  const autoMap = new Map(
    ((rows ?? []) as { product_id: string; auto_sold_out: boolean }[]).map((r) => [r.product_id, r.auto_sold_out]),
  )
  const { data: products } = await supabase
    .from('products')
    .select('id, name, is_sold_out')
    .in('id', statuses.map((s) => s.product_id))
  const soldOutMap = new Map(
    ((products ?? []) as { id: string; is_sold_out: boolean }[]).map((p) => [p.id, p.is_sold_out]),
  )

  const now = new Date().toISOString()
  for (const s of statuses) {
    const isSoldOut = soldOutMap.get(s.product_id) ?? false
    if (s.remaining <= 0 && !isSoldOut) {
      await supabase
        .from('products')
        .update({ is_sold_out: true, sold_out_at: now, updated_at: now })
        .eq('id', s.product_id)
      await supabase
        .from('product_stock')
        .update({ auto_sold_out: true, updated_at: now })
        .eq('date', date)
        .eq('product_id', s.product_id)
      await supabase.from('product_soldout_log').insert({
        product_id: s.product_id,
        product_name: s.product_name,
        sold_out_at: now,
        date,
      })
    } else if (s.remaining > 0 && isSoldOut && autoMap.get(s.product_id)) {
      await supabase
        .from('products')
        .update({ is_sold_out: false, sold_out_at: null, updated_at: now })
        .eq('id', s.product_id)
      await supabase
        .from('product_stock')
        .update({ auto_sold_out: false, updated_at: now })
        .eq('date', date)
        .eq('product_id', s.product_id)
    }
  }
}

/** 注文明細から、商品ごとの数を数える */
export function countByProduct(items: { product_id: string; quantity: number }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.product_id, (counts.get(item.product_id) ?? 0) + item.quantity)
  return counts
}

/**
 * 注文が在庫を使う日
 * テイクアウトは受け取り日（"YYYY-MM-DD HH:MM" の日付部分）、それ以外は注文した日
 * （これから登録する注文で created_at がなければ今日）
 */
export function stockDateFor(order: {
  table_id: string
  pickup_at?: string | null
  created_at?: string | null
}): string {
  if (order.table_id === TAKEOUT_TABLE_ID && order.pickup_at) return order.pickup_at.slice(0, 10)
  if (order.created_at) {
    return new Date(new Date(order.created_at).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }
  return todayJST()
}
