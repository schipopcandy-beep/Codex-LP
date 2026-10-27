'use client'

import { useCallback, useEffect, useState } from 'react'
import { SEAT_PREFERENCES, SEAT_PREFERENCE_LABELS, type SeatPreference, type WaitlistEntry } from '@/lib/types'
import { useConfirm } from '@/components/admin/useConfirm'
import { usePolling } from '@/lib/usePolling'

type QueueEntry = WaitlistEntry & { ahead: number; estimate_minutes: number }

interface WaitlistAdminResponse {
  accepting: boolean
  open_time: string | null
  close_time: string | null
  vacancy: { table: { vacant: number; total: number }; counter: { vacant: number; total: number } }
  queue: QueueEntry[]
  called: WaitlistEntry[]
  absent: WaitlistEntry[]
  done: WaitlistEntry[]
}

type Action = 'call' | 'seat' | 'absent' | 'return' | 'cancel' | 'undo'

/** 受付からの経過（分） */
const minutesSince = (iso: string | null) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0

const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : ''

/** 希望の席の目印（テーブル・カウンターの希望だけ色を付けて目立たせる） */
function SeatBadge({ preference }: { preference: SeatPreference }) {
  const tone =
    preference === 'table'
      ? 'text-blue-700 bg-blue-50'
      : preference === 'counter'
        ? 'text-amber-800 bg-amber-100'
        : 'text-brown-500 bg-cream-100'
  return <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${tone}`}>{SEAT_PREFERENCE_LABELS[preference]}</span>
}

/**
 * 順番待ちの管理
 * 呼び出す → 来たら「案内済み」／いなければ「不在」。
 * 不在のお客様が戻ったら「来店した」で、次に空いた席へ優先して案内する（取り消しにはしない）。
 */
export default function WaitlistAdminPage() {
  const [data, setData] = useState<WaitlistAdminResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [walkInSize, setWalkInSize] = useState(1)
  const [walkInSeat, setWalkInSeat] = useState<SeatPreference>('any')
  const [walkInName, setWalkInName] = useState('')
  const [issued, setIssued] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/waitlist', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '読み込めませんでした')
      setData(json)
      setError(null)
    } catch (e) {
      setError(
        (e as Error).message.includes('waitlist_entries')
          ? '順番待ちの表がまだありません。案内したSQLを実行してください'
          : '読み込めませんでした。通信状況を確認してください',
      )
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])
  // 20秒ごとに取り直す（経過時間の表示もあわせて更新する）
  usePolling(() => {
    load()
    setTick((t) => t + 1)
  }, 20000)

  const act = async (entry: WaitlistEntry, action: Action) => {
    if (action === 'cancel' && !(await confirm(`${entry.number}番の順番待ちを取り消しますか？`, { confirmLabel: '取り消す', danger: true }))) {
      return
    }
    setBusy(entry.id)
    try {
      const res = await fetch(`/api/admin/waitlist/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setError('操作できませんでした。通信状況を確認して、もう一度お試しください')
    }
    setBusy(null)
    await load()
  }

  const addWalkIn = async () => {
    setBusy('walk-in')
    setIssued(null)
    try {
      const res = await fetch('/api/admin/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ party_size: walkInSize, seat_preference: walkInSeat, display_name: walkInName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setIssued(json.number)
      setWalkInName('')
      setWalkInSize(1)
      setWalkInSeat('any')
    } catch {
      setError('受付できませんでした')
    }
    setBusy(null)
    await load()
  }

  const button = (label: string, onClick: () => void, tone: 'primary' | 'plain' | 'danger', disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-xl text-sm font-bold border disabled:opacity-40 ${
        tone === 'primary'
          ? 'bg-matcha-600 text-white border-matcha-600 active:bg-matcha-500'
          : tone === 'danger'
            ? 'bg-white text-red-600 border-red-200'
            : 'bg-white text-brown-700 border-cream-300'
      }`}
    >
      {label}
    </button>
  )

  const Who = ({ entry }: { entry: WaitlistEntry }) => (
    <div className="min-w-0">
      <p className="font-bold text-brown-800">
        <span className="text-2xl tabular-nums mr-2">{entry.number}</span>
        {entry.party_size}名
        <SeatBadge preference={entry.seat_preference ?? 'any'} />
        {entry.returned_at && <span className="ml-2 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">不在から戻り・優先</span>}
      </p>
      <p className="text-xs text-brown-500">
        {entry.display_name ?? (entry.line_user_id ? 'LINE' : '店頭受付')}
        {entry.line_user_id && ' ・LINE通知あり'}
        <span className="ml-2">受付 {timeOf(entry.created_at)}（{minutesSince(entry.created_at)}分前）</span>
      </p>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="section-title">順番待ち</h1>
          {data && (
            <p className="text-sm text-brown-500">
              {data.open_time
                ? `受付時間 ${data.open_time}〜${data.close_time}（${data.accepting ? '受付中' : '受付時間外'}）`
                : '本日は休業日（受付していません）'}
            </p>
          )}
        </div>
        {data && (
          <p className="text-sm text-brown-600">
            空き テーブル {data.vacancy.table.vacant}/{data.vacancy.table.total}卓・カウンター {data.vacancy.counter.vacant}/
            {data.vacancy.counter.total}席
          </p>
        )}
      </div>

      {error && <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

      {/* 呼び出し中 */}
      {data && data.called.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold text-matcha-600">呼び出し中（{data.called.length}組）</h2>
          {data.called.map((e) => (
            <div key={e.id} className="card p-3 border-2 border-matcha-500 bg-green-50 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Who entry={e} />
                <p className="text-xs text-matcha-600 font-bold">{timeOf(e.called_at)} に呼び出し（{minutesSince(e.called_at)}分前）</p>
              </div>
              <div className="flex gap-2">
                {button('案内済み', () => act(e, 'seat'), 'primary', busy === e.id)}
                {button('不在', () => act(e, 'absent'), 'danger', busy === e.id)}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 待ち */}
      <section className="space-y-2">
        <h2 className="font-bold text-brown-700">待ち（{data?.queue.length ?? 0}組）</h2>
        {data && data.queue.length === 0 && <p className="text-sm text-brown-400">待っているお客様はいません</p>}
        {data?.queue.map((e, i) => (
          <div key={e.id} className={`card p-3 flex items-center justify-between gap-3 flex-wrap ${i === 0 ? 'border-2 border-amber-300' : ''}`}>
            <div>
              <Who entry={e} />
              <p className="text-xs text-brown-400">{i === 0 ? '次に案内' : `前に${e.ahead}組`}・お客様への目安 約{e.estimate_minutes}分</p>
            </div>
            <div className="flex gap-2">
              {button('呼び出す', () => act(e, 'call'), 'primary', busy === e.id)}
              {button('案内済み', () => act(e, 'seat'), 'plain', busy === e.id)}
              {button('取消', () => act(e, 'cancel'), 'danger', busy === e.id)}
            </div>
          </div>
        ))}
      </section>

      {/* 不在 */}
      {data && data.absent.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold text-red-700">不在（{data.absent.length}組）</h2>
          <p className="text-xs text-brown-500">お店に来たら「来店した」を押すと、次に空いた席へ優先して案内する順番に入ります</p>
          {data.absent.map((e) => (
            <div key={e.id} className="card p-3 border border-red-200 flex items-center justify-between gap-3 flex-wrap">
              <Who entry={e} />
              <div className="flex gap-2">
                {button('来店した', () => act(e, 'return'), 'primary', busy === e.id)}
                {button('取消', () => act(e, 'cancel'), 'danger', busy === e.id)}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 店頭受付 */}
      <section className="card p-4 space-y-3">
        <h2 className="font-bold text-brown-700">店頭で受付（LINEを使わないお客様）</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={walkInSize}
            onChange={(e) => setWalkInSize(Number(e.target.value))}
            className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-base"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}名
              </option>
            ))}
          </select>
          <select
            value={walkInSeat}
            onChange={(e) => setWalkInSeat(e.target.value as SeatPreference)}
            className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-base"
          >
            {SEAT_PREFERENCES.map((pref) => (
              <option key={pref} value={pref}>
                {SEAT_PREFERENCE_LABELS[pref]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={walkInName}
            onChange={(e) => setWalkInName(e.target.value)}
            placeholder="お名前（任意）"
            maxLength={50}
            className="flex-1 min-w-32 rounded-xl border border-cream-300 bg-white px-3 py-2 text-base"
          />
          {button('受付する', addWalkIn, 'primary', busy === 'walk-in')}
        </div>
        {issued !== null && (
          <p className="text-lg font-bold text-matcha-600">受付番号 {issued}番 を発行しました（番号をお客様にお伝えください）</p>
        )}
      </section>

      {/* 本日の案内済み・取消 */}
      {data && data.done.length > 0 && (
        <details className="card p-3">
          <summary className="font-bold text-brown-600 cursor-pointer">本日の案内済み・取消（{data.done.length}組）</summary>
          <div className="mt-2 divide-y divide-cream-200">
            {data.done.map((e) => (
              <div key={e.id} className="py-2 flex items-center justify-between gap-3">
                <p className="text-sm text-brown-600">
                  <span className="font-bold tabular-nums mr-2">{e.number}</span>
                  {e.party_size}名・{SEAT_PREFERENCE_LABELS[e.seat_preference ?? 'any']}・{e.status === 'seated' ? `案内済み ${timeOf(e.seated_at)}` : '取消'}
                </p>
                {button('待ちに戻す', () => act(e, 'undo'), 'plain', busy === e.id)}
              </div>
            ))}
          </div>
        </details>
      )}
      {confirmDialog}
    </div>
  )
}
