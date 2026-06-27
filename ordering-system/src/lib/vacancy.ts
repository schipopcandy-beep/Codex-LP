import { createServiceRoleClient } from '@/lib/supabase/server'

/** 店内席の table_id 一覧（テイクアウトを除く） */
export const SEAT_IDS = [
  'table-1', 'table-2', 'table-3', 'table-4',
  'counter-1', 'counter-2', 'counter-3', 'counter-4',
]

export interface VacancyResult {
  total: number
  occupied: number
  vacant: number
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

  const total = SEAT_IDS.length
  const occupied = occupiedSeats.size
  return { total, occupied, vacant: total - occupied }
}

/** 空席状況をLINEメッセージ用のテキストに整形する */
export function buildVacancyText(v: VacancyResult): string {
  if (v.vacant === 0) {
    return [
      '【ただいまの空席状況】',
      '',
      '🈵 満席です',
      '',
      `全${v.total}席 / 空席 0席`,
      '少々お待ちいただく場合がございます。',
      '',
      '※ ご注文状況をもとにした目安です。',
    ].join('\n')
  }

  return [
    '【ただいまの空席状況】',
    '',
    `🈳 空席 ${v.vacant}席`,
    '',
    `全${v.total}席 / 利用中 ${v.occupied}席 / 空席 ${v.vacant}席`,
    '',
    '※ ご注文状況をもとにした目安です。',
    '実際の空席と異なる場合がございます。',
  ].join('\n')
}
