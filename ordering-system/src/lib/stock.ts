import type { SupabaseClient } from '@supabase/supabase-js'
import {
  LUNCH_PLATE_NAME_PREFIX,
  OPTION_NAMES,
  TAKEOUT_TABLE_ID,
  type OptionKey,
} from '@/lib/types'
import { addDays, todayJST } from '@/lib/business-hours'

/** 残りがこの数以下になったら「残りわずか」として知らせる */
export const LOW_STOCK_THRESHOLD = 5

/**
 * 仕込み数を数える単位（キー）
 * - 商品ごと:            "product:<商品ID>"
 * - ランチプレート合計:  "group:lunch_plate"（1個用・2個用をまとめて数える）
 * - オプション:          "option:egg_yolk" など（付けた数を数える）
 */
export type StockKey = string
export const LUNCH_PLATE_STOCK_KEY: StockKey = 'group:lunch_plate'
export const productStockKey = (productId: string): StockKey => `product:${productId}`
export const optionStockKey = (key: OptionKey): StockKey => `option:${key}`

/** 仕込み数を数える単位1つ分の仕込み数と残り数 */
export interface StockStatus {
  stock_key: StockKey
  /** 画面に出す名前（商品名、「ランチプレート（1個・2個の合計）」など） */
  label: string
  prepared_qty: number
  ordered_qty: number
  remaining: number
}

/** 数え方に必要な明細の項目 */
interface CountableItem {
  product_id: string
  quantity: number
  with_topping?: boolean | null
  with_egg_yolk?: boolean | null
}

/** ランチプレートの商品ID（1個用・2個用） */
export async function getLunchPlateIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from('products').select('id').like('name', `${LUNCH_PLATE_NAME_PREFIX}%`)
  return new Set(((data ?? []) as { id: string }[]).map((p) => p.id))
}

/**
 * 明細を、仕込み数を数える単位ごとの数に変える
 * ランチプレートは合計で数え、オプション（とろろ昆布・漬け卵黄）は付けた数を数える。
 * ランチプレートの中で選んだおにぎりは、そのおにぎりの数に含める。
 */
export function countByStockKey(items: CountableItem[], lunchPlateIds: Set<string>): Map<StockKey, number> {
  const counts = new Map<StockKey, number>()
  const add = (key: StockKey, qty: number) => counts.set(key, (counts.get(key) ?? 0) + qty)
  for (const item of items) {
    add(lunchPlateIds.has(item.product_id) ? LUNCH_PLATE_STOCK_KEY : productStockKey(item.product_id), item.quantity)
    if (item.with_topping) add(optionStockKey('tororo'), item.quantity)
    if (item.with_egg_yolk) add(optionStockKey('egg_yolk'), item.quantity)
  }
  return counts
}

/**
 * 注文を修正したときに増える数（単位ごと）。減る分は含めない
 * before / after は修正前・修正後の明細（新しく追加するときは before を空にする）
 */
export function increasedByStockKey(
  before: CountableItem[],
  after: CountableItem[],
  lunchPlateIds: Set<string>,
): Map<StockKey, number> {
  const b = countByStockKey(before, lunchPlateIds)
  const a = countByStockKey(after, lunchPlateIds)
  const result = new Map<StockKey, number>()
  for (const [key, qty] of a) {
    const diff = qty - (b.get(key) ?? 0)
    if (diff > 0) result.set(key, diff)
  }
  return result
}

/** 日本時間の YYYY-MM-DD の 0:00〜24:00 を UTC の範囲で返す */
function utcRangeOf(date: string): { start: string; end: string } {
  const toUtc = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString()
  return { start: toUtc(date), end: toUtc(addDays(date, 1)) }
}

/**
 * その日に使う分として注文された数（単位ごと）
 * - 店内注文（席から頼んだお持ち帰りを含む）: 注文した日
 * - テイクアウト: 受け取り日（受け取り日がなければ注文した日）
 */
export async function getOrderedCounts(
  supabase: SupabaseClient,
  date: string,
): Promise<Map<StockKey, number>> {
  const { start, end } = utcRangeOf(date)
  const select = 'id, order_items(product_id, quantity, with_topping, with_egg_yolk)'

  const [eatin, takeoutByPickup, takeoutNoPickup, lunchPlateIds] = await Promise.all([
    supabase.from('orders').select(select).neq('table_id', TAKEOUT_TABLE_ID).gte('created_at', start).lt('created_at', end),
    supabase.from('orders').select(select).eq('table_id', TAKEOUT_TABLE_ID).like('pickup_at', `${date}%`),
    supabase
      .from('orders')
      .select(select)
      .eq('table_id', TAKEOUT_TABLE_ID)
      .is('pickup_at', null)
      .gte('created_at', start)
      .lt('created_at', end),
    getLunchPlateIds(supabase),
  ])

  const items: CountableItem[] = []
  for (const res of [eatin, takeoutByPickup, takeoutNoPickup]) {
    for (const order of (res.data ?? []) as { order_items?: CountableItem[] }[]) {
      items.push(...(order.order_items ?? []))
    }
  }
  return countByStockKey(items, lunchPlateIds)
}

/** 単位の表示名 */
function labelOf(key: StockKey, productNames: Map<string, string>): string {
  if (key === LUNCH_PLATE_STOCK_KEY) return 'ランチプレート（1個・2個の合計）'
  if (key.startsWith('option:')) return OPTION_NAMES[key.slice('option:'.length) as OptionKey] ?? key
  return productNames.get(key.slice('product:'.length)) ?? '不明'
}

/**
 * 仕込み数を入れている単位の残り数
 * 表がまだない（SQL未実行）場合は空（＝数を管理していない）
 */
export async function getStockStatus(supabase: SupabaseClient, date: string): Promise<StockStatus[]> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('stock_key, prepared_qty')
    .eq('date', date)
  if (error || !data || data.length === 0) return []
  const rows = data as { stock_key: string; prepared_qty: number }[]

  const productIds = rows.filter((r) => r.stock_key.startsWith('product:')).map((r) => r.stock_key.slice(8))
  const [ordered, productsRes] = await Promise.all([
    getOrderedCounts(supabase, date),
    productIds.length
      ? supabase.from('products').select('id, name').in('id', productIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const productNames = new Map(((productsRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))

  return rows.map((row) => {
    const orderedQty = ordered.get(row.stock_key) ?? 0
    return {
      stock_key: row.stock_key,
      label: labelOf(row.stock_key, productNames),
      prepared_qty: row.prepared_qty,
      ordered_qty: orderedQty,
      remaining: row.prepared_qty - orderedQty,
    }
  })
}

/**
 * これから注文する数が残り数を超えないか確認する
 * 足りないものがあれば、お客様に見せるメッセージを返す（なければ null）
 */
export async function checkStock(
  supabase: SupabaseClient,
  date: string,
  requested: Map<StockKey, number>,
): Promise<string | null> {
  if (requested.size === 0) return null
  const statuses = await getStockStatus(supabase, date)
  const shortages = statuses.filter((s) => (requested.get(s.stock_key) ?? 0) > Math.max(0, s.remaining))
  if (shortages.length === 0) return null

  const detail = shortages
    .map((s) => (s.remaining > 0 ? `「${s.label}」は残り${s.remaining}個` : `「${s.label}」は売り切れ`))
    .join('、')
  return `申し訳ありません。${detail}です。数を減らしてもう一度ご注文ください。`
}

/** 単位ごとの「今売り切れか」を読む・切り替える */
async function soldOutTargets(supabase: SupabaseClient, key: StockKey, lunchPlateIds: Set<string>) {
  const now = new Date().toISOString()

  if (key.startsWith('option:')) {
    const optionKey = key.slice('option:'.length)
    const { data } = await supabase.from('product_options').select('is_sold_out').eq('key', optionKey).maybeSingle()
    return {
      isSoldOut: !!(data as { is_sold_out?: boolean } | null)?.is_sold_out,
      set: async (soldOut: boolean) => {
        await supabase
          .from('product_options')
          .upsert({ key: optionKey, is_sold_out: soldOut, updated_at: now }, { onConflict: 'key' })
      },
    }
  }

  const ids = key === LUNCH_PLATE_STOCK_KEY ? [...lunchPlateIds] : [key.slice('product:'.length)]
  const { data } = await supabase.from('products').select('id, name, is_sold_out').in('id', ids)
  const products = (data ?? []) as { id: string; name: string; is_sold_out: boolean }[]
  return {
    // ランチプレートは、1個用・2個用のどちらも売り切れのときに「売り切れ」とみなす
    isSoldOut: products.length > 0 && products.every((p) => p.is_sold_out),
    set: async (soldOut: boolean) => {
      await supabase
        .from('products')
        .update({ is_sold_out: soldOut, sold_out_at: soldOut ? now : null, updated_at: now })
        .in('id', ids)
      if (soldOut && products.length > 0) {
        await supabase.from('product_soldout_log').insert(
          products.map((p) => ({ product_id: p.id, product_name: p.name, sold_out_at: now, date: todayJST() })),
        )
      }
    },
  }
}

/**
 * 残り数に合わせて、今日の売り切れ表示を自動で切り替える
 * - 残りが0以下になった単位 → 売り切れにする（自動で売り切れにした印を残す）
 * - 注文の修正などで残りが戻った単位 → 自動で売り切れにしたものだけ販売中に戻す
 * 売り切れの表示は「今日」の状態なので、今日の分だけを対象にする。
 */
export async function syncAutoSoldOut(supabase: SupabaseClient, date: string = todayJST()): Promise<void> {
  if (date !== todayJST()) return

  const statuses = await getStockStatus(supabase, date)
  if (statuses.length === 0) return

  const [{ data: rows }, lunchPlateIds] = await Promise.all([
    supabase.from('stock_counts').select('stock_key, auto_sold_out').eq('date', date),
    getLunchPlateIds(supabase),
  ])
  const autoMap = new Map(
    ((rows ?? []) as { stock_key: string; auto_sold_out: boolean }[]).map((r) => [r.stock_key, r.auto_sold_out]),
  )

  const setAuto = (key: StockKey, value: boolean) =>
    supabase
      .from('stock_counts')
      .update({ auto_sold_out: value, updated_at: new Date().toISOString() })
      .eq('date', date)
      .eq('stock_key', key)

  for (const s of statuses) {
    const target = await soldOutTargets(supabase, s.stock_key, lunchPlateIds)
    if (s.remaining <= 0 && !target.isSoldOut) {
      await target.set(true)
      await setAuto(s.stock_key, true)
    } else if (s.remaining > 0 && target.isSoldOut && autoMap.get(s.stock_key)) {
      await target.set(false)
      await setAuto(s.stock_key, false)
    }
  }
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
