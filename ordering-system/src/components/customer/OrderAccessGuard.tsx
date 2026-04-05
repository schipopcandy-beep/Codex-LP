'use client'

import { useEffect, useState, useCallback } from 'react'

interface Props {
  tableId: string
  children: React.ReactNode
  onUserIdReady?: (userId: string) => void
}

type GuardStatus =
  | 'initializing'
  | 'logging-in'
  | 'checking-friend'
  | 'not-friend'
  | 'ready'
  | 'error-no-seat'

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? ''
const ADD_FRIEND_URL = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL ?? ''

export default function OrderAccessGuard({ tableId, children, onUserIdReady }: Props) {
  const [status, setStatus] = useState<GuardStatus>('initializing')
  const [userId, setUserId] = useState<string | null>(null)
  const [recheckError, setRecheckError] = useState<string | null>(null)

  const checkFriend = useCallback(async (uid: string): Promise<boolean> => {
    const res = await fetch('/api/line/friend-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    })
    if (!res.ok) throw new Error('友だち確認APIの呼び出しに失敗しました')
    const data = await res.json()
    return data.isFriend as boolean
  }, [])

  useEffect(() => {
    // 席情報なし → エラー
    if (!tableId) {
      setStatus('error-no-seat')
      return
    }

    // LIFF_ID 未設定 → 通常Webとして動作（LINEチェックをスキップ）
    if (!LIFF_ID) {
      setStatus('ready')
      return
    }

    let cancelled = false

    const init = async () => {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: LIFF_ID })

        if (cancelled) return

        // ─── LINEアプリ外（通常ブラウザ）→ LINE認証をスキップして注文画面へ ───
        // QRコードは通常URLなので、ブラウザで開いた場合はそのまま表示する
        if (!liff.isInClient()) {
          setStatus('ready')
          return
        }

        // ─── LINEアプリ内 → ログイン確認 ───
        if (!liff.isLoggedIn()) {
          setStatus('logging-in')
          liff.login({ redirectUri: window.location.href })
          return
        }

        const profile = await liff.getProfile()
        if (cancelled) return

        const uid = profile.userId
        setUserId(uid)
        onUserIdReady?.(uid)
        setStatus('checking-friend')

        const isFriend = await checkFriend(uid)
        if (cancelled) return

        setStatus(isFriend ? 'ready' : 'not-friend')
      } catch {
        if (cancelled) return
        // LIFF初期化・取得失敗 → graceful fallback（通常Webとして動作）
        setStatus('ready')
      }
    }

    init()
    return () => { cancelled = true }
  }, [tableId, checkFriend, onUserIdReady])

  const handleRecheck = useCallback(async () => {
    if (!userId) return
    setRecheckError(null)
    setStatus('checking-friend')
    try {
      const isFriend = await checkFriend(userId)
      setStatus(isFriend ? 'ready' : 'not-friend')
    } catch {
      setStatus('not-friend')
      setRecheckError('確認に失敗しました。もう一度お試しください。')
    }
  }, [userId, checkFriend])

  // --- ローディング ---
  if (
    status === 'initializing' ||
    status === 'logging-in' ||
    status === 'checking-friend'
  ) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-cream-50 p-8">
        <div className="w-10 h-10 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin" />
        <p className="text-brown-500 text-base">
          {status === 'logging-in' ? 'LINEログイン画面へ移動中...' : '読み込み中...'}
        </p>
      </div>
    )
  }

  // --- 席情報なし ---
  if (status === 'error-no-seat') {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center bg-cream-50">
        <div className="max-w-sm">
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-brown-700 text-lg font-semibold mb-2">席情報が確認できませんでした</p>
          <p className="text-brown-500 text-sm">
            卓上のQRコードを読み直してください。
          </p>
        </div>
      </div>
    )
  }

  // --- 友だち未追加（LINEアプリ内のみ表示される） ---
  if (status === 'not-friend') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-cream-50">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 space-y-5">
          {/* LINE アイコン */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-[#06C755] flex items-center justify-center">
              <svg viewBox="0 0 48 48" className="w-10 h-10 fill-white">
                <path d="M24 4C12.95 4 4 11.82 4 21.4c0 5.92 3.56 11.14 9.02 14.34-.35 1.32-1.28 4.8-1.47 5.54-.24.91.33 1.9 1.28 1.42.76-.39 9.54-6.3 11.57-7.67.51.06 1.03.09 1.6.09 11.05 0 20-7.82 20-17.4C46 11.82 35.05 4 24 4zm-6.4 22.5H14.3v-8.6h1.9v6.7h3.4v1.9zm2.5 0h-1.9v-8.6h1.9v8.6zm8.2 0h-1.9l-3.4-5.1v5.1h-1.9v-8.6h1.9l3.4 5.1v-5.1h1.9v8.6zm6.5-6.7h-3.4v1.6h3.4v1.9h-3.4v1.6h3.4v1.9h-5.3v-8.6h5.3v1.6z" />
              </svg>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-brown-800">
              注文前にLINE追加をお願いします
            </h1>
            <p className="text-sm text-brown-500 leading-relaxed">
              この席から注文するには、LINE公式アカウントの友だち追加が必要です。
              <br />
              追加後に下のボタンから注文へ進めます。
            </p>
          </div>

          {tableId && (
            <p className="text-center text-xs text-brown-400">
              席: {tableId}
            </p>
          )}

          {recheckError && (
            <p className="text-center text-xs text-red-500">{recheckError}</p>
          )}

          <div className="space-y-3">
            {ADD_FRIEND_URL ? (
              <a
                href={ADD_FRIEND_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 rounded-xl bg-[#06C755] text-white font-semibold text-base text-center active:opacity-80"
              >
                友だち追加する
              </a>
            ) : (
              <p className="text-center text-xs text-brown-400">
                ※ 友だち追加URLが設定されていません（管理者にお問い合わせください）
              </p>
            )}

            <button
              onClick={handleRecheck}
              className="w-full py-3 rounded-xl border-2 border-brown-600 text-brown-700 font-semibold text-base active:opacity-80"
            >
              追加後、注文へ進む
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- 条件クリア: 注文画面を表示 ---
  return <>{children}</>
}
