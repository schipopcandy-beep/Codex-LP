export type TableId =
  | 'table-1'
  | 'table-2'
  | 'table-3'
  | 'table-4'
  | 'counter-1'
  | 'counter-2'
  | 'counter-3'
  | 'counter-4'

export type OrderStatus = 'new' | 'preparing' | 'served' | 'paid'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: '新規',
  preparing: '調理中',
  served: '提供済み',
  paid: '会計済み',
}

export const TOPPING_NAME = 'とろろ昆布'
export const TOPPING_PRICE = 50

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
  created_at: string
  product?: Product
}

export interface CartItem {
  product: Product
  quantity: number
  with_topping: boolean
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
