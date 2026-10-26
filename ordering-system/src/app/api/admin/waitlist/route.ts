import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { todayJST } from '@/lib/business-hours'
import { getVacancy } from '@/lib/vacancy'
import { toSeatPreference } from '@/lib/types'
import { estimateMinutes, getAcceptance, getTodayEntries, queueOf } from '@/lib/waitlist'

/** 管理用: 今日の順番待ち（案内する順・各組の目安時間つき）と空席 */
export async function GET() {
  const supabase = createServiceRoleClient()
  try {
    const [entries, vacancy, acceptance] = await Promise.all([
      getTodayEntries(supabase),
      getVacancy(),
      getAcceptance(supabase),
    ])
    const hasVacancy = vacancy.vacant > 0
    const queue = queueOf(entries).map((e, i) => ({ ...e, ahead: i, estimate_minutes: estimateMinutes(i, hasVacancy) }))
    return NextResponse.json(
      {
        ...acceptance,
        vacancy,
        queue,
        called: entries.filter((e) => e.status === 'called'),
        absent: entries.filter((e) => e.status === 'absent'),
        done: entries.filter((e) => e.status === 'seated' || e.status === 'canceled').reverse(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * 管理用: 店頭で順番待ちを受付する（LINEを使わないお客様）
 * body: { party_size, seat_preference?, display_name? }
 */
export async function POST(req: NextRequest) {
  const body: { party_size?: number; seat_preference?: string; display_name?: string } = await req.json()
  const partySize = Number(body.party_size)
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
    return NextResponse.json({ error: '人数を選んでください' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  for (let attempt = 0; attempt < 5; attempt++) {
    const entries = await getTodayEntries(supabase)
    const next = Math.max(0, ...entries.map((e) => e.number)) + 1
    const { error } = await supabase.from('waitlist_entries').insert({
      date: todayJST(),
      number: next,
      party_size: partySize,
      seat_preference: toSeatPreference(body.seat_preference),
      display_name: body.display_name?.trim().slice(0, 50) || null,
      // 店頭のお客様には LINE で知らせないので、お知らせ済み扱い
      notified_soon: true,
    })
    if (!error) return NextResponse.json({ number: next })
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: '混み合っています。もう一度お試しください' }, { status: 503 })
}
