'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ORDER_LIFF_ID, SEAT_PREFERENCES, SEAT_PREFERENCE_LABELS, storageUrl, type SeatPreference } from '@/lib/types'
import { useConfirm } from '@/components/admin/useConfirm'
import { usePolling } from '@/lib/usePolling'

interface SeatGroup {
  total: number
  vacant: number
}

interface WaitlistStatusResponse {
  accepting: boolean
  open_time: string | null
  close_time: string | null
  vacancy: { vacant: number; table: SeatGroup; counter: SeatGroup }
  waiting_count: number
  estimate_minutes: number
  entry: {
    number: number
    party_size: number
    seat_preference: SeatPreference
    status: 'waiting' | 'called' | 'absent'
    ahead: number
    estimate_minutes: number
  } | null
}

/** この端末の受付を見分けるための番号（LINEでログインできなかったときにも使う） */
const TOKEN_KEY = 'orihaya-waitlist-token'
const LOGIN_TRIED_KEY = 'orihaya-waitlist-login-tried'
/** 状況を取り直す間隔（ミリ秒） */
const REFRESH_MS = 30000

function readOrCreateToken(): string {
  try {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) return saved
    const created =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(TOKEN_KEY, created)
    return created
  } catch {
    // 保存できない端末でも、この画面を開いている間は使える
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/**
 * 順番待ちの受付（LINEから開く）
 * 空席・待ち組数・目安時間を見て、人数を選んで受付すると番号が出る。
 * 順番が近づいたとき・呼び出しのときは LINE でお知らせする。
 */
export default function WaitlistUI() {
  const [token, setToken] = useState<string | null>(null)
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [lineReady, setLineReady] = useState(false)
  const [status, setStatus] = useState<WaitlistStatusResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [partySize, setPartySize] = useState<number | null>(null)
  const [seatPreference, setSeatPreference] = useState<SeatPreference>('any')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirm, confirmDialog] = useConfirm()

  // LINEのログイン（通知を送るため）。うまくいかなくても受付はできる
  useEffect(() => {
    setToken(readOrCreateToken())
    let cancelled = false
    const timer = setTimeout(() => !cancelled && setLineReady(true), 5000)
    ;(async () => {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: ORDER_LIFF_ID })
        if (cancelled) return
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          if (cancelled) return
          setLineUserId(profile.userId)
          setDisplayName(profile.displayName)
        } else if (!liff.isInClient()) {
          let tried = true
          try {
            tried = sessionStorage.getItem(LOGIN_TRIED_KEY) === '1'
            sessionStorage.setItem(LOGIN_TRIED_KEY, '1')
          } catch {
            // 記録できない環境では繰り返さない
          }
          if (!tried) {
            liff.login({ redirectUri: window.location.href })
            return
          }
        }
      } catch {
        // LINEの外などで使えないときは、通知なしで受付する
      } finally {
        clearTimeout(timer)
        if (!cancelled) setLineReady(true)
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const params = new URLSearchParams({ token })
      if (lineUserId) params.set('line_user_id', lineUserId)
      const res = await fetch(`/api/waitlist?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setStatus(await res.json())
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [token, lineUserId])

  useEffect(() => {
    if (lineReady) load()
  }, [lineReady, load])
  usePolling(load, REFRESH_MS, lineReady)

  const register = async () => {
    if (!token || !partySize || submitting) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party_size: partySize,
          seat_preference: seatPreference,
          token,
          line_user_id: lineUserId ?? undefined,
          display_name: displayName ?? undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '受付できませんでした')
      await load()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async () => {
    if (!token) return
    if (!(await confirm('順番待ちを取り消しますか？', { confirmLabel: '取り消す', danger: true }))) return
    const res = await fetch('/api/waitlist/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, line_user_id: lineUserId ?? undefined }),
    })
    if (!res.ok) setMessage('取り消せませんでした。もう一度お試しください')
    await load()
  }

  const entry = status?.entry

  return (
    <div className="min-h-dvh bg-cream-50 flex flex-col">
      <header className="border-b border-cream-300 px-4 py-2 flex justify-center">
        <Image src={storageUrl('logo.png')} alt="織はや" width={120} height={48} className="object-contain h-10 w-auto" />
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-5">
        <h1 className="section-title text-center">順番待ち受付</h1>

        {!status ? (
          <p className="text-center text-brown-400 py-12">{loadError ? '状況を取得できませんでした' : '確認中...'}</p>
        ) : (
          <>
            {/* 自分の受付 */}
            {entry && (
              <section
                className={`rounded-3xl border-2 p-6 text-center space-y-3 ${
                  entry.status === 'called'
                    ? 'border-matcha-500 bg-green-50'
                    : entry.status === 'absent'
                      ? 'border-red-300 bg-red-50'
                      : 'border-amber-300 bg-amber-50'
                }`}
              >
                <p className="text-sm font-bold text-brown-600">あなたの受付番号</p>
                <p className="text-6xl font-bold text-brown-800 tabular-nums">{entry.number}</p>
                <p className="text-sm text-brown-500">
                  {entry.party_size}名様・{SEAT_PREFERENCE_LABELS[entry.seat_preference ?? 'any']}
                </p>
                {entry.status === 'called' && (
                  <p className="text-xl font-bold text-matcha-600">順番になりました！お店にお越しください</p>
                )}
                {entry.status === 'absent' && (
                  <p className="text-base font-bold text-red-700 leading-relaxed">
                    お呼びしましたが、いらっしゃらなかったため次の方をご案内しました。
                    <br />
                    お店に着いたらスタッフにお声がけください。次に空いたお席へご案内します。
                  </p>
                )}
                {entry.status === 'waiting' && (
                  <div>
                    <p className="text-lg font-bold text-brown-800">
                      {entry.ahead === 0 ? '次のご案内です' : `あなたの前に ${entry.ahead}組`}
                    </p>
                    <p className="text-sm text-brown-600">
                      {entry.estimate_minutes === 0 ? 'まもなくご案内できます' : `待ち時間の目安 約${entry.estimate_minutes}分`}
                    </p>
                  </div>
                )}
                <p className="text-xs text-brown-500 leading-relaxed">
                  {lineUserId
                    ? '順番が近づいたとき・お呼びするときに、LINEでお知らせします'
                    : 'この画面は自動で更新されます。開いたままにしてお待ちください'}
                </p>
                {entry.status !== 'called' && (
                  <button type="button" onClick={cancel} className="text-sm text-brown-400 underline underline-offset-2">
                    順番待ちを取り消す
                  </button>
                )}
              </section>
            )}

            {/* お店の状況 */}
            <section className="card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-xs font-semibold text-brown-500">テーブル 空き</p>
                  <p className="text-2xl font-bold text-brown-800 tabular-nums">
                    {status.vacancy.table.vacant}
                    <span className="text-sm text-brown-400">/{status.vacancy.table.total}卓</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-brown-500">カウンター 空き</p>
                  <p className="text-2xl font-bold text-brown-800 tabular-nums">
                    {status.vacancy.counter.vacant}
                    <span className="text-sm text-brown-400">/{status.vacancy.counter.total}席</span>
                  </p>
                </div>
              </div>
              <div className="border-t border-cream-300 pt-3 text-center">
                <p className="text-sm font-semibold text-brown-500">現在の順番待ち</p>
                <p className="text-3xl font-bold text-brown-800 tabular-nums">
                  {status.waiting_count}
                  <span className="text-base ml-0.5">組</span>
                </p>
                {!entry && (
                  <p className="text-sm text-brown-600">
                    {status.estimate_minutes === 0 ? '今すぐご案内できます' : `今から受付すると 約${status.estimate_minutes}分`}
                  </p>
                )}
              </div>
            </section>

            {/* 受付 */}
            {!entry &&
              (status.accepting ? (
                <section className="card p-4 space-y-4">
                  <p className="font-bold text-brown-800 text-center">何名様でしょうか？</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPartySize(n)}
                        className={`h-12 rounded-xl text-lg font-bold border-2 ${
                          partySize === n
                            ? 'bg-brown-600 text-white border-brown-600'
                            : 'bg-cream-50 text-brown-700 border-cream-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="font-bold text-brown-800 text-center">ご希望のお席</p>
                  <div className="grid grid-cols-3 gap-2">
                    {SEAT_PREFERENCES.map((pref) => (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => setSeatPreference(pref)}
                        aria-pressed={seatPreference === pref}
                        className={`h-12 rounded-xl text-sm font-bold border-2 ${
                          seatPreference === pref
                            ? 'bg-brown-600 text-white border-brown-600'
                            : 'bg-cream-50 text-brown-700 border-cream-300'
                        }`}
                      >
                        {SEAT_PREFERENCE_LABELS[pref]}
                      </button>
                    ))}
                  </div>
                  {seatPreference !== 'any' && (
                    <p className="text-xs text-brown-500 text-center leading-relaxed">
                      ご希望のお席が空くまでお待ちいただく場合があります。
                      <br />
                      「どちらでもよい」を選ぶと、早くご案内できることがあります。
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={register}
                    disabled={!partySize || submitting}
                    className="btn-primary w-full py-4 text-lg disabled:opacity-40"
                  >
                    {submitting ? '受付中...' : '順番待ちを受付する'}
                  </button>
                  <p className="text-xs text-brown-500 text-center leading-relaxed">
                    {lineUserId
                      ? '順番が近づいたとき・お呼びするときに、LINEでお知らせします'
                      : 'LINEアプリから開くと、順番が近づいたときにLINEでお知らせします'}
                  </p>
                </section>
              ) : (
                <section className="card p-4 text-center text-brown-600">
                  {status.open_time
                    ? `順番待ちの受付は営業時間内（${status.open_time}〜${status.close_time}）のみです`
                    : '本日は休業日です'}
                </section>
              ))}

            {message && (
              <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{message}</p>
            )}

            <p className="text-xs text-brown-400 text-center leading-relaxed">
              ※ 待ち時間は目安です。前後する場合がございます。
              <br />
              ※ お呼びしたときにいらっしゃらない場合は、次の方を先にご案内します。
            </p>
          </>
        )}
      </main>
      {confirmDialog}
    </div>
  )
}
