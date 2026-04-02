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
