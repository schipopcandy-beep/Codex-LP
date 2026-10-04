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

export type OrderStatus = 'new' | 'added' | 'preparing' | 'served' | 'paid'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: '新規',
  added: '追加',
  preparing: '調理中',
  served: '提供済み',
  paid: '会計済み',
}

/** テイクアウト用ステータスラベル（提供済み → 準備済み） */
export const TAKEOUT_STATUS_LABELS: Record<OrderStatus, string> = {
  new: '新規',
  added: '追加',
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

/** 限定おにぎりの商品名（DBの name と一致させること） */
export const LIMITED_ONIGIRI_NAME = '限定おにぎり'

/** おにぎりのカテゴリ名（DBの category と一致させること） */
export const NIGIRI_CATEGORY = 'おにぎり'

/** テイクアウトだけで売る商品のカテゴリ名（店内注文のメニューには出さない） */
export const TAKEOUT_ONLY_CATEGORY = 'テイクアウト限定'

/**
 * 海苔→とろろ昆布への変更を選べる商品か
 * おにぎりはすべて対象（DBの topping_available は参照しない）
 */
export function isToppingSelectable(product: Product): boolean {
  return product.category === NIGIRI_CATEGORY
}

export const TOPPING_NAME = 'とろろ昆布'
export const TOPPING_PRICE = 50

/** トッピングの正体は「海苔→とろろ昆布への変更」なので、変更である旨が伝わる表記を使う */
export const TOPPING_CHANGE_LABEL = '海苔をとろろ昆布に変更'
/** カート・明細で使う短い表記 */
export const TOPPING_CART_LABEL = 'とろろ昆布に変更'

/** 漬け卵黄（全おにぎりに付けられるオプション） */
export const EGG_YOLK_NAME = '漬け卵黄'
export const EGG_YOLK_PRICE = 100
/** 注文画面で使う表記 */
export const EGG_YOLK_CHANGE_LABEL = '漬け卵黄を追加'
/** カート・明細で使う短い表記 */
export const EGG_YOLK_CART_LABEL = '漬け卵黄追加'

/** おにぎりのオプションの種類（売り切れ設定に使う） */
export type OptionKey = 'tororo' | 'egg_yolk'
export const OPTION_NAMES: Record<OptionKey, string> = {
  tororo: TOPPING_NAME,
  egg_yolk: EGG_YOLK_NAME,
}
export const OPTION_PRICES: Record<OptionKey, number> = {
  tororo: TOPPING_PRICE,
  egg_yolk: EGG_YOLK_PRICE,
}
/** オプションの売り切れ状態（true = 売り切れ） */
export type OptionSoldOut = Record<OptionKey, boolean>
export const NO_OPTION_SOLD_OUT: OptionSoldOut = { tororo: false, egg_yolk: false }

/** おにぎり1個に付けるオプションの選び方 */
export interface NigiriOptions {
  /** 海苔→とろろ昆布に変更（+50円） */
  tororo: boolean
  /** 漬け卵黄を追加（+100円） */
  eggYolk: boolean
}
export const NO_OPTIONS: NigiriOptions = { tororo: false, eggYolk: false }

/** 明細1行のオプション追加料金（1個あたり） */
export function optionPrice(item: { with_topping?: boolean | null; with_egg_yolk?: boolean | null }): number {
  return (item.with_topping ? TOPPING_PRICE : 0) + (item.with_egg_yolk ? EGG_YOLK_PRICE : 0)
}

/** 明細に添えるオプションの表記（例: 「とろろ昆布に変更・漬け卵黄追加」）。なければ空文字 */
export function optionLabel(item: { with_topping?: boolean | null; with_egg_yolk?: boolean | null }): string {
  return [
    item.with_topping ? TOPPING_CART_LABEL : null,
    item.with_egg_yolk ? EGG_YOLK_CART_LABEL : null,
  ]
    .filter(Boolean)
    .join('・')
}

export const DRINK_CATEGORY = 'ドリンク'

export type DrinkTiming = 'before' | 'with' | 'after'
export const DRINK_TIMING_LABELS: Record<DrinkTiming, string> = {
  before: '食前',
  with: '同時',
  after: '食後',
}

/**
 * ランチプレートの商品名（DBの name と一致させること）
 * おにぎりの個数ごとに別商品として登録する
 */
export const LUNCH_PLATE_NAME_PREFIX = 'ランチプレート'
export const LUNCH_PLATE_1_NAME = 'ランチプレート（おにぎり1個）'
export const LUNCH_PLATE_2_NAME = 'ランチプレート（おにぎり2個）'

/** ランチプレート商品かどうか */
export function isLunchPlate(product: Product): boolean {
  return product.name.startsWith(LUNCH_PLATE_NAME_PREFIX)
}

/** そのランチプレートで選ぶおにぎりの個数（商品名から判定、既定は1個） */
export function lunchPlateNigiriCount(product: Product): number {
  return product.name.includes('2個') ? 2 : 1
}

/** ランチ開始時刻（時・JST）。この時刻以降はランチプレートのみ注文可 */
export const LUNCH_START_HOUR = 11
/** ランチ終了時刻（時・JST）。null なら閉店まで。これ以降は単品おにぎりも注文可 */
export const LUNCH_END_HOUR: number | null = 14
/** ランチプレートの販売終了時刻（時・JST）。これ以降はグレーアウト表示 */
export const LUNCH_PLATE_END_HOUR = 15

/**
 * テスト期間中のみ true。ランチプレートを時間帯に関係なく注文できるようにする。
 * ※2026年10月上旬をめどに false に戻し、11:00〜15:00 の販売に戻すこと
 */
export const LUNCH_PLATE_ALWAYS_AVAILABLE = true

/** ランチタイムの表示用ラベル（例: "11:00〜14:00"） */
export const LUNCH_TIME_LABEL =
  LUNCH_END_HOUR !== null
    ? `${LUNCH_START_HOUR}:00〜${LUNCH_END_HOUR}:00`
    : `${LUNCH_START_HOUR}:00〜`

/** 現在時刻（時・JST） */
function jstHourNow(): number {
  return parseInt(
    new Intl.DateTimeFormat('ja-JP', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tokyo' })
      .format(new Date()),
    10,
  )
}

/** 現在（JST）がランチタイムかどうか */
export function isLunchTimeNow(): boolean {
  const hour = jstHourNow()
  if (hour < LUNCH_START_HOUR) return false
  if (LUNCH_END_HOUR !== null && hour >= LUNCH_END_HOUR) return false
  return true
}

/** ランチプレートが注文できる時間帯か（11:00〜15:00） */
export function isLunchPlateOrderable(): boolean {
  if (LUNCH_PLATE_ALWAYS_AVAILABLE) return true
  const hour = jstHourNow()
  return hour >= LUNCH_START_HOUR && hour < LUNCH_PLATE_END_HOUR
}

/** ランチプレートの販売が終了したか（15:00以降） */
export function isLunchPlateClosed(): boolean {
  if (LUNCH_PLATE_ALWAYS_AVAILABLE) return false
  return jstHourNow() >= LUNCH_PLATE_END_HOUR
}

/** ランチプレート1枚分のおにぎり1個の選択内容 */
export interface LunchNigiriUnit {
  productId: string
  /** 海苔→とろろ昆布に変更（+50円） */
  tororo: boolean
  /** 漬け卵黄を追加（+100円） */
  eggYolk?: boolean
}

/**
 * ランチプレート選択時のおにぎり追加料金
 * しゃけ筋子: +200円 / 筋子: +100円 / 限定おにぎり: +100円 /
 * 450円以上: +50円 / その他: 0円
 */
export function getLunchPlateSurcharge(product: Product): number {
  if (product.name === 'しゃけ筋子') return 200
  if (product.name.includes('筋子')) return 100   // 筋子・極み筋子など
  if (product.name === LIMITED_ONIGIRI_NAME) return 100
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
  party_size?: number | null
  created_at: string
  updated_at: string
  pickup_at?: string | null  // "YYYY-MM-DD HH:MM"（テイクアウトのみ）
  /** テイクアウトのお客様名（LINEの表示名、または店頭で店員が入力した名前） */
  customer_name?: string | null
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
  /** 漬け卵黄を追加（+100円） */
  with_egg_yolk?: boolean
  timing?: DrinkTiming | null
  /** ランチプレート内おにぎりのプレート番号（0始まり）。null = 通常アイテム */
  lunch_plate_index?: number | null
  /** 席から注文したお持ち帰り分。同じ伝票内でイートインと区別する */
  is_takeout?: boolean
  created_at: string
  product?: Product
}

/**
 * 同じ注文とみなす明細の時間差（ミリ秒）
 * 1回の注文の明細は同時に登録されるため、ごく短い差だけを許容する
 */
const ORDER_BATCH_GAP_MS = 2_000

/**
 * 明細を「注文された回」ごとに分け、明細ID → 回番号 を返す
 * 0 = 1回目の注文 / 1 = 追加1（2回目）/ 2 = 追加2（3回目）…
 *
 * 回の区切りは、直前の明細ではなく「その回の最初の明細」からの差で判定する。
 * 直前との差で判定すると、短い間隔で注文が続いたときに別々の回が
 * ひとつにつながってしまうため。
 */
export function getOrderBatchIndexes(items: OrderItem[]): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const indexes = new Map<string, number>()
  let batch = 0
  let batchStartTime: number | null = null

  for (const item of sorted) {
    const time = new Date(item.created_at).getTime()
    if (batchStartTime === null) {
      batchStartTime = time
    } else if (time - batchStartTime > ORDER_BATCH_GAP_MS) {
      batch++
      batchStartTime = time
    }
    indexes.set(item.id, batch)
  }
  return indexes
}

/**
 * ランチプレートごとに、選ばれたおにぎりをまとめる
 * 戻り値: ランチプレートの明細ID → プレート1枚ごとのおにぎりの明細
 *
 * おにぎりの明細には何枚目のプレートか（lunch_plate_index）しか記録されず、
 * 番号は注文の回ごとに0から振り直される。そのため注文の回ごとに分けたうえで、
 * プレートの種類（おにぎり1個用・2個用）と、そのプレートのおにぎりの数を突き合わせて結びつける。
 */
export function groupLunchPlateNigiri(items: OrderItem[]): Map<string, OrderItem[][]> {
  const batches = getOrderBatchIndexes(items)
  const result = new Map<string, OrderItem[][]>()
  const batchNumbers = [...new Set(items.map((i) => batches.get(i.id) ?? 0))]

  for (const b of batchNumbers) {
    const inBatch = items.filter((i) => (batches.get(i.id) ?? 0) === b)
    const plates = inBatch.filter((i) => i.product && isLunchPlate(i.product))

    const groupMap = new Map<number, OrderItem[]>()
    for (const n of inBatch.filter((i) => i.lunch_plate_index != null)) {
      const idx = n.lunch_plate_index as number
      groupMap.set(idx, [...(groupMap.get(idx) ?? []), n])
    }
    const remaining = [...groupMap.entries()].sort(([a], [b]) => a - b).map(([, g]) => g)

    for (const plate of plates) {
      const required = plate.product ? lunchPlateNigiriCount(plate.product) : 1
      const groups: OrderItem[][] = []
      for (let k = 0; k < plate.quantity && remaining.length > 0; k++) {
        const matchIdx = remaining.findIndex((g) => g.length === required)
        groups.push(remaining.splice(matchIdx >= 0 ? matchIdx : 0, 1)[0])
      }
      result.set(plate.id, groups)
    }
  }
  return result
}

/** 回番号のラベル（0 = 最初の注文なので空文字） */
export function orderBatchLabel(batch: number): string {
  return batch === 0 ? '' : `追加${batch}`
}

export interface CartItem {
  product: Product
  quantity: number
  with_topping: boolean
  /** 漬け卵黄を追加（+100円） */
  with_egg_yolk?: boolean
  timing?: DrinkTiming   // ドリンクのみ
  /** 店内注文と一緒に頼むお持ち帰り分 */
  is_takeout?: boolean
}

export function calcCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (item.product.price + optionPrice(item)) * item.quantity, 0)
}

export function calcOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + (item.unit_price + optionPrice(item)) * item.quantity, 0)
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

/**
 * 店内の席。全部でテーブル4卓・カウンター3卓。
 * （TABLE_NAMES の counter-4 は過去の注文を表示するためだけに残している）
 */
export const SEAT_TABLE_IDS = [
  'table-1', 'table-2', 'table-3', 'table-4',
  'counter-1', 'counter-2', 'counter-3',
] as const

/**
 * 各席のQRコードに入れる席コード → 内部 tableId
 * 他の卓を選んで注文できないよう、推測しにくいランダムな文字列にしている。
 * 変更する場合は、新しい席コードでQRコードを作り直すこと。
 */
export const SEAT_TO_TABLE_ID: Record<string, string> = {
  g5mw2x43: 'table-1',
  kudjxqm7: 'table-2',
  bz5pnez8: 'table-3',
  '5hyt9hz7': 'table-4',
  tdq47jf3: 'counter-1',
  pyb548h6: 'counter-2',
  nhmdzw7a: 'counter-3',
}

/**
 * 以前のQRコードの席コード（t1〜t4、c1〜c3）を受け付けるか。
 * 新しいQRコードへの貼り替えが終わるまでの間だけ true にしておく。
 * ※貼り替えが終わったら false にすること（推測しやすく、他の卓で注文できてしまうため）
 */
export const LEGACY_SEAT_CODES_ENABLED = true

const LEGACY_SEAT_TO_TABLE_ID: Record<string, string> = {
  t1: 'table-1',
  t2: 'table-2',
  t3: 'table-3',
  t4: 'table-4',
  c1: 'counter-1',
  c2: 'counter-2',
  c3: 'counter-3',
}

/** 店内注文のLIFF ID（エンドポイント: https://codex-lp-k187.vercel.app/order） */
export const ORDER_LIFF_ID = process.env.NEXT_PUBLIC_ORDER_LIFF_ID || '2009693463-xVibg5DN'

/**
 * 席のQRコードに入れるURL
 * LIFFのURLにすると、LINEアプリが入っているスマホではLINEアプリで開き、
 * IDやパスワードを入れずにLINEの情報を受け取れる。
 */
export function seatQrUrl(seatCode: string): string {
  return `https://liff.line.me/${ORDER_LIFF_ID}?seat=${encodeURIComponent(seatCode)}`
}

/**
 * seat パラメータ（席コード）を tableId（例: "table-1"）に変換する。
 * 未知の値は null を返す。
 */
export function seatToTableId(seat: string | null | undefined): string | null {
  if (!seat) return null
  return (
    SEAT_TO_TABLE_ID[seat] ??
    (LEGACY_SEAT_CODES_ENABLED ? LEGACY_SEAT_TO_TABLE_ID[seat] ?? null : null)
  )
}

/** 内部 tableId → QRコードの seat パラメータ（例: table-1 → t1） */
export function tableIdToSeat(tableId: string | null | undefined): string | null {
  if (!tableId) return null
  return Object.entries(SEAT_TO_TABLE_ID).find(([, id]) => id === tableId)?.[0] ?? null
}
