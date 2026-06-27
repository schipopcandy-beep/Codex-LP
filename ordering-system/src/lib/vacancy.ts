import { createServiceRoleClient } from '@/lib/supabase/server'

/** テーブル席の table_id 一覧 */
export const TABLE_SEAT_IDS = ['table-1', 'table-2', 'table-3', 'table-4']
/** カウンター席の table_id 一覧 */
export const COUNTER_SEAT_IDS = ['counter-1', 'counter-2', 'counter-3', 'counter-4']
/** 店内席の table_id 一覧（テイクアウトを除く） */
export const SEAT_IDS = [...TABLE_SEAT_IDS, ...COUNTER_SEAT_IDS]

export interface SeatGroup {
  total: number
  occupied: number
  vacant: number
}

export interface VacancyResult {
  total: number
  occupied: number
  vacant: number
  table: SeatGroup
  counter: SeatGroup
}

function countGroup(occupiedSeats: Set<string>, seatIds: string[]): SeatGroup {
  const occupied = seatIds.filter((id) => occupiedSeats.has(id)).length
  return { total: seatIds.length, occupied, vacant: seatIds.length - occupied }
}

/** 未会計の注文をもとに店内の空席状況を集計する */
export async function getVacancy(): Promise<VacancyResult> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('orders')
    .select('table_id')
    .neq('status', 'paid')

  if (error) throw new Error(error.message)

  const occupiedSeats = new Set(
    (data ?? [])
      .map((o) => o.table_id)
      .filter((id) => SEAT_IDS.includes(id)),
  )

  const table = countGroup(occupiedSeats, TABLE_SEAT_IDS)
  const counter = countGroup(occupiedSeats, COUNTER_SEAT_IDS)

  return {
    total: SEAT_IDS.length,
    occupied: table.occupied + counter.occupied,
    vacant: table.vacant + counter.vacant,
    table,
    counter,
  }
}

/** 空席状況をLINEメッセージ用のテキストに整形する */
export function buildVacancyText(v: VacancyResult): string {
  const lines = ['【ただいまの空席状況】', '']

  if (v.vacant === 0) {
    lines.push('🈵 満席です', '', '少々お待ちいただく場合がございます。')
  } else {
    lines.push(`🈳 空席 ${v.vacant}席`)
  }

  lines.push(
    '',
    `テーブル席：空き ${v.table.vacant}/${v.table.total}席`,
    `カウンター席：空き ${v.counter.vacant}/${v.counter.total}席`,
    '',
    '※ ご注文状況をもとにした目安です。',
    '実際の空席と異なる場合がございます。',
  )

  return lines.join('\n')
}
