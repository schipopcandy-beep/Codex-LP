export type TableId =
  | 'table-1'
  | 'table-2'
  | 'table-3'
  | 'table-4'
  | 'counter-1'
  | 'counter-2'
  | 'counter-3'
  | 'counter-4'
  | 'takeout'

/** テイクアウト注文の table_id 定数 */
export const TAKEOUT_TABLE_ID = 'takeout'

// ─────────────────────────────────────────
// テイクアウト 受取日時スケジュール
// ─────────────────────────────────────────

export const TAKEOUT_DEFAULT_OPEN = '07:30'
export const TAKEOUT_DEFAULT_CLOSE = '14:00'
/** 受取スロットの間隔（分） */
export const TAKEOUT_SLOT_MINUTES = 30

export interface TakeoutSchedule {
  date: string       // YYYY-MM-DD
  is_open: boolean
  open_time: string  // HH:MM
  close_time: string // HH:MM
}

/** 曜日ラベル */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/** YYYY-MM-DD → "4月10日（木）" 形式 */
export function formatScheduleDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${m}月${d}日（${WEEKDAY_LABELS[dt.getDay()]}）`
}

/** open_time〜close_time を TAKEOUT_SLOT_MINUTES 刻みで生成 */
export function generatePickupSlots(openTime: string, closeTime: string): string[] {
  const [oh, om] = openTime.split(':').map(Number)
  const [ch, cm] = closeTime.split(':').map(Number)
  const slots: string[] = []
  let total = oh * 60 + om
  const end = ch * 60 + cm
  while (total <= end) {
    const h = Math.floor(total / 60)
    const mn = total % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`)
    total += TAKEOUT_SLOT_MINUTES
  }
  return slots
}

/** 公開スケジュールAPIのレスポンス型 */
export interface AvailableDay {
  date: string   // YYYY-MM-DD
  label: string  // "4月10日（木）"
  slots: string[] // ["07:30", "08:00", ...]
}

export type OrderStatus = 'new' | 'preparing' | 'served' | 'paid'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: '新規',
  preparing: '調理中',
  served: '提供済み',
  paid: '会計済み',
}

/** テイクアウト用ステータスラベル（提供済み → 準備済み） */
export const TAKEOUT_STATUS_LABELS: Record<OrderStatus, string> = {
  new: '新規',
  preparing: '調理中',
  served: '準備済み',
  paid: '会計済み',
}

/** table_id に応じた正しいステータスラベルを返す */
export function getStatusLabel(status: OrderStatus, tableId?: string): string {
  return tableId === TAKEOUT_TABLE_ID
    ? TAKEOUT_STATUS_LABELS[status]
    : ORDER_STATUS_LABELS[status]
}

/** UUID → 4桁注文番号（0000〜9999） */
export function orderShortId(orderId: string): string {
  return (parseInt(orderId.replace(/-/g, '').slice(0, 8), 16) % 10000)
    .toString().padStart(4, '0')
}

export const TOPPING_NAME = 'とろろ昆布'
export const TOPPING_PRICE = 50

export const DRINK_CATEGORY = 'ドリンク'

export type DrinkTiming = 'before' | 'with' | 'after'
export const DRINK_TIMING_LABELS: Record<DrinkTiming, string> = {
  before: '食前',
  with: '同時',
  after: '食後',
}

/** ランチプレートの商品名（DBの name と一致させること） */
export const LUNCH_PLATE_NAME = 'ランチプレート'

/**
 * ランチプレート選択時のおにぎり追加料金
 * しゃけ筋子: +200円 / 筋子: +100円 / 450円以上: +50円 / その他: 0円
 */
export function getLunchPlateSurcharge(product: Product): number {
  if (product.name === 'しゃけ筋子') return 200
  if (product.name.includes('筋子')) return 100   // 筋子・極み筋子など
  if (product.price >= 450) return 50
  return 0
}

export interface Table {
  id: string
  name: string
  is_active: boolean
}

export interface Product {
  id: string
  name: string
  price: number
  description: string | null
  image_url: string | null
  category: string
  sort_order: number
  is_sold_out: boolean
  topping_available: boolean
}

export interface Order {
  id: string
  table_id: string
  status: OrderStatus
  created_at: string
  updated_at: string
  pickup_at?: string | null  // "YYYY-MM-DD HH:MM"（テイクアウトのみ）
  table?: Table
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  with_topping: boolean
  timing?: DrinkTiming | null
  /** ランチプレート内おにぎりのプレート番号（0始まり）。null = 通常アイテム */
  lunch_plate_index?: number | null
  created_at: string
  product?: Product
}

export interface CartItem {
  product: Product
  quantity: number
  with_topping: boolean
  timing?: DrinkTiming   // ドリンクのみ
}

export function calcCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const toppingCost = item.with_topping ? TOPPING_PRICE : 0
    return sum + (item.product.price + toppingCost) * item.quantity
  }, 0)
}

export function calcOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    const toppingCost = item.with_topping ? TOPPING_PRICE : 0
    return sum + (item.unit_price + toppingCost) * item.quantity
  }, 0)
}

export const STORAGE_BASE = 'https://wgjfwjourukgtxpkuaup.supabase.co/storage/v1/object/public/product-images'
export const storageUrl = (filename: string) => `${STORAGE_BASE}/${encodeURIComponent(filename)}`

export const TABLE_NAMES: Record<string, string> = {
  'table-1': 'テーブル 1',
  'table-2': 'テーブル 2',
  'table-3': 'テーブル 3',
  'table-4': 'テーブル 4',
  'counter-1': 'カウンター 1',
  'counter-2': 'カウンター 2',
  'counter-3': 'カウンター 3',
  'counter-4': 'カウンター 4',
  'takeout': 'テイクアウト',
}

/** QRコードの seat パラメータ → 内部 tableId 変換マップ
 *  例: t1 → table-1, c3 → counter-3
 */
export const SEAT_TO_TABLE_ID: Record<string, string> = {
  t1: 'table-1',
  t2: 'table-2',
  t3: 'table-3',
  t4: 'table-4',
  c1: 'counter-1',
  c2: 'counter-2',
  c3: 'counter-3',
  c4: 'counter-4',
}

/**
 * seat パラメータ（例: "t1"）を tableId（例: "table-1"）に変換する。
 * 未知の値は null を返す。
 */
export function seatToTableId(seat: string | null | undefined): string | null {
  if (!seat) return null
  return SEAT_TO_TABLE_ID[seat] ?? null
}
