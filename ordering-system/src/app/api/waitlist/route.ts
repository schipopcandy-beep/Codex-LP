import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { todayJST } from '@/lib/business-hours'
import { getVacancy } from '@/lib/vacancy'
import {
  ACTIVE_STATUSES,
  estimateMinutes,
  getAcceptance,
  getTodayEntries,
  queueOf,
} from '@/lib/waitlist'
import type { WaitlistEntry } from '@/lib/types'

/** お客様の受付（token か LINE ID で探す）。まだ案内していないものだけ */
function findMine(entries: WaitlistEntry[], token?: string | null, lineUserId?: string | null) {
  return entries.find(
    (e) =>
      (ACTIVE_STATUSES as readonly string[]).includes(e.status) &&
      ((token && e.token === token) || (lineUserId && e.line_user_id === lineUserId)),
  )
}

/** 受付1件の、お客様に見せる状況 */
function entryView(entry: WaitlistEntry, entries: WaitlistEntry[], hasVacancy: boolean) {
  const queue = queueOf(entries)
  const index = queue.findIndex((e) => e.id === entry.id)
  const ahead = index === -1 ? 0 : index
  return {
    number: entry.number,
    party_size: entry.party_size,
    status: entry.status,
    ahead,
    estimate_minutes: entry.status === 'waiting' ? estimateMinutes(ahead, hasVacancy) : 0,
  }
}

/**
 * お客様向け: 空席・待ち状況と、自分の受付
 * GET ?token=...&line_user_id=...
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const lineUserId = req.nextUrl.searchParams.get('line_user_id')
  const supabase = createServiceRoleClient()

  try {
    const [entries, vacancy, acceptance] = await Promise.all([
      getTodayEntries(supabase),
      getVacancy(),
      getAcceptance(supabase),
    ])
    const hasVacancy = vacancy.vacant > 0
    const waitingCount = queueOf(entries).length
    const mine = findMine(entries, token, lineUserId)

    return NextResponse.json(
      {
        ...acceptance,
        vacancy,
        waiting_count: waitingCount,
        // これから受付する人の目安
        estimate_minutes: estimateMinutes(waitingCount, hasVacancy),
        entry: mine ? entryView(mine, entries, hasVacancy) : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * お客様向け: 順番待ちを受付する（営業時間内のみ）
 * body: { party_size, token, line_user_id?, display_name? }
 * すでに受付中なら、その受付を返す
 */
export async function POST(req: NextRequest) {
  const body: { party_size?: number; token?: string; line_user_id?: string; display_name?: string } =
    await req.json()
  const partySize = Number(body.party_size)
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
    return NextResponse.json({ error: '人数を選んでください' }, { status: 400 })
  }
  if (!body.token) return NextResponse.json({ error: '受付できませんでした' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const acceptance = await getAcceptance(supabase)
  if (!acceptance.accepting) {
    return NextResponse.json(
      {
        error: acceptance.open_time
          ? `順番待ちの受付は営業時間内（${acceptance.open_time}〜${acceptance.close_time}）のみです`
          : '本日は休業日のため、順番待ちを受け付けておりません',
      },
      { status: 400 },
    )
  }

  let entries = await getTodayEntries(supabase)
  const existing = findMine(entries, body.token, body.line_user_id)
  if (!existing) {
    // 受付番号は今日の最大+1。同時に受付があって番号がぶつかったら、取り直す
    let inserted = false
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const next = Math.max(0, ...entries.map((e) => e.number)) + 1
      const queueBefore = queueOf(entries).length
      const { error } = await supabase.from('waitlist_entries').insert({
        date: todayJST(),
        number: next,
        party_size: partySize,
        token: body.token,
        line_user_id: body.line_user_id || null,
        display_name: body.display_name?.slice(0, 50) || null,
        // 受付した時点で前が1組以下なら、「まもなく」のお知らせは送らない（画面で分かるため）
        notified_soon: queueBefore <= 1,
      })
      if (!error) inserted = true
      else if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
      entries = await getTodayEntries(supabase)
    }
    if (!inserted) return NextResponse.json({ error: '混み合っています。もう一度お試しください' }, { status: 503 })
  }

  const vacancy = await getVacancy()
  const mine = findMine(entries, body.token, body.line_user_id)!
  return NextResponse.json({ entry: entryView(mine, entries, vacancy.vacant > 0) })
}
