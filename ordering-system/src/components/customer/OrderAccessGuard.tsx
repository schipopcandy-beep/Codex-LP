'use client'

import { useEffect, useState } from 'react'

interface Props {
  tableId: string
  children: React.ReactNode
  onUserIdReady?: (userId: string) => void
  onPartySizeReady?: (size: number) => void
}

type GuardStatus =
  | 'initializing'   // 起動中（LIFF初期化・LINE ID取得）
  | 'logging-in'     // LINEログインへリダイレクト中
  | 'party-size'     // 人数選択
  | 'ready'
  | 'error-no-seat'

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

/** sessionStorage キー: LINEログインを一度試したフラグ（リダイレクトループ防止） */
const LOGIN_TRIED_KEY = 'orihaya-order-login-tried'

/**
 * 店内注文の入口。
 * 友だち追加は求めないが、来店記録・通知のためにLINE IDを取得する。
 * カメラでQRを読んで通常ブラウザで開かれた場合はLINEログインへ一度だけ誘導し、
 * ログインが成立しなかった場合はLINE IDなしで注文を続行する。
 */
export default function OrderAccessGuard({ tableId, children, onUserIdReady, onPartySizeReady }: Props) {
  const [status, setStatus] = useState<GuardStatus>('initializing')
  const [selectedPartySize, setSelectedPartySize] = useState<number | null>(null)

  useEffect(() => {
    if (!tableId) {
      setStatus('error-no-seat')
      return
    }

    // LIFF未設定 → LINE IDなしでそのまま進む
    if (!LIFF_ID) {
      setStatus('party-size')
      return
    }

    let cancelled = false

    const init = async () => {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: LIFF_ID })

        if (cancelled) return

        if (!liff.isLoggedIn()) {
          // 一度リダイレクトしても未ログインのまま戻った場合（ログインを断った等）は
          // それ以上ループさせず、LINE IDなしで注文へ進む
          if (sessionStorage.getItem(LOGIN_TRIED_KEY)) {
            setStatus('party-size')
            return
          }
          sessionStorage.setItem(LOGIN_TRIED_KEY, '1')
          setStatus('logging-in')
          liff.login({ redirectUri: window.location.href })
          return
        }

        sessionStorage.removeItem(LOGIN_TRIED_KEY)
        const profile = await liff.getProfile()
        if (cancelled) return
        onUserIdReady?.(profile.userId)
        setStatus('party-size')
      } catch {
        // LIFF失敗時はLINE IDなしでそのまま注文へ進む
        if (!cancelled) setStatus('party-size')
      }
    }

    init()
    return () => { cancelled = true }
  }, [tableId, onUserIdReady])

  // --- ローディング ---
  if (status === 'initializing' || status === 'logging-in') {
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
          <p className="text-brown-500 text-sm">卓上のQRコードを読み直してください。</p>
        </div>
      </div>
    )
  }

  // --- 人数選択 ---
  if (status === 'party-size') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-cream-50">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-3xl">🍙</p>
            <h1 className="text-xl font-bold text-brown-800">何名様でしょうか？</h1>
            <p className="text-sm text-brown-400">人数を選択してください</p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSelectedPartySize(n)}
                className={`h-14 rounded-xl text-lg font-bold border-2 transition-colors ${
                  selectedPartySize === n
                    ? 'bg-brown-600 text-white border-brown-600'
                    : 'bg-cream-50 text-brown-700 border-cream-300 active:bg-cream-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!selectedPartySize) return
              onPartySizeReady?.(selectedPartySize)
              setStatus('ready')
            }}
            disabled={!selectedPartySize}
            className="w-full py-4 rounded-xl bg-brown-600 text-white font-bold text-lg disabled:opacity-40 active:bg-brown-700"
          >
            注文へ進む
          </button>
        </div>
      </div>
    )
  }

  // --- 注文画面 ---
  return <>{children}</>
}
