import { createServiceRoleClient } from '@/lib/supabase/server'

/** テーブル卓の table_id 一覧 */
export const TABLE_SEAT_IDS = ['table-1', 'table-2', 'table-3', 'table-4']
/** カウンター席の table_id 一覧（全3席） */
export const COUNTER_SEAT_IDS = ['counter-1', 'counter-2', 'counter-3']
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

/**
 * カウンターの埋まっている席数
 * カウンターは1席に1つQRを置くが、2名以上で並んで座ることもあるため、
 * 注文時に選んだ人数の分だけ席を使っている扱いにする（人数がなければ1名）。
 * 合計がカウンターの席数を超える場合は満席で止める。
 */
function countCounter(rows: { table_id: string; party_size: number | null }[]): SeatGroup {
  const peopleBySeat = new Map<string, number>()
  for (const row of rows) {
    if (!COUNTER_SEAT_IDS.includes(row.table_id)) continue
    const people = Math.max(1, row.party_size ?? 1)
    // 同じ席に未会計の伝票が複数ある場合は、多い方の人数を使う
    peopleBySeat.set(row.table_id, Math.max(peopleBySeat.get(row.table_id) ?? 0, people))
  }
  const total = COUNTER_SEAT_IDS.length
  const used = [...peopleBySeat.values()].reduce((sum, n) => sum + n, 0)
  const occupied = Math.min(total, used)
  return { total, occupied, vacant: total - occupied }
}

/** 未会計の注文をもとに店内の空席状況を集計する */
export async function getVacancy(): Promise<VacancyResult> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('orders')
    .select('table_id, party_size')
    .in('table_id', SEAT_IDS)
    .neq('status', 'paid')

  if (error) throw new Error(error.message)

  const occupiedSeats = new Set(
    (data ?? [])
      .map((o) => o.table_id)
      .filter((id) => SEAT_IDS.includes(id)),
  )

  const table = countGroup(occupiedSeats, TABLE_SEAT_IDS)
  const counter = countCounter(data ?? [])

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
    lines.push('🈵 満席です', '少々お待ちいただく場合がございます。', '')
  }

  lines.push(
    `テーブル：空き ${v.table.vacant}/${v.table.total}卓`,
    `カウンター：空き ${v.counter.vacant}/${v.counter.total}席`,
    '',
    '※ ご注文状況をもとにした目安です。',
    '実際の空席と異なる場合がございます。',
  )

  return lines.join('\n')
}
