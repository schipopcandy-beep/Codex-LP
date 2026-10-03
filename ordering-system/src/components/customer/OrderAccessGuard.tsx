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
  | 'party-size'     // 人数選択
  | 'ready'
  | 'error-no-seat'

/**
 * 店内注文用のLIFF ID（エンドポイント: https://codex-lp-k187.vercel.app/order）
 * テイクアウト用のLIFF（NEXT_PUBLIC_LIFF_ID）はエンドポイントが /takeout のため、
 * /order でLINEログインすると戻り先が範囲外になり 400 Bad Request になる。
 * そのため店内注文には専用のLIFFを使う。LIFF IDは公開されても問題ない値。
 */
const LIFF_ID = process.env.NEXT_PUBLIC_ORDER_LIFF_ID || '2009693463-xVibg5DN'

/** このLIFFでLINEログインしてよい画面（エンドポイントの範囲内） */
const LOGIN_PATH_PREFIX = '/order'

/** LINEログインを一度試したかどうか（ログインを断った場合に繰り返さないため） */
const LOGIN_TRIED_KEY = 'orihaya-order-login-tried'

/** LINEログイン画面への移動を待つ上限（ミリ秒）。過ぎたらLINE IDなしで進める */
const LOGIN_REDIRECT_TIMEOUT_MS = 12000

/**
 * LINEの初期化を待つ上限（ミリ秒）
 * LINE側の応答が返らないと「読み込み中」のまま進まなくなるため、
 * 上限を過ぎたら先に人数選択を出す。
 */
const LIFF_TIMEOUT_MS = 5000

function readLoginTried(): boolean {
  try {
    return sessionStorage.getItem(LOGIN_TRIED_KEY) === '1'
  } catch {
    // 記録できない環境では、ログイン画面へ繰り返し移らないよう「試した」扱いにする
    return true
  }
}

function writeLoginTried(value: boolean) {
  try {
    if (value) sessionStorage.setItem(LOGIN_TRIED_KEY, '1')
    else sessionStorage.removeItem(LOGIN_TRIED_KEY)
  } catch {
    // 保存できなくても注文は続けられる
  }
}

/**
 * 店内注文の入口。
 * 来店後のLINEメッセージのためにLINE IDを取得してから、人数選択→注文へ進む。
 * - カメラでQRを読んで普通のブラウザで開いた場合は、LINEログインを1回だけ挟む
 * - ログインを断った・失敗した・応答がない場合も、LINE IDなしで注文は続けられる
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

    // 起動中のときだけ人数選択へ進める。
    // 人数を選び終えた後に初期化が遅れて完了しても、画面を戻さないため
    const proceed = () => {
      if (!cancelled) setStatus((s) => (s === 'initializing' ? 'party-size' : s))
    }

    let timedOut = false
    let loginTimer: ReturnType<typeof setTimeout> | undefined

    // LINEの応答が返らない場合でも、上限を過ぎたら先に進める
    const timer = setTimeout(() => {
      timedOut = true
      proceed()
    }, LIFF_TIMEOUT_MS)

    const init = async () => {
      let redirecting = false
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: LIFF_ID })

        if (cancelled) return

        if (liff.isLoggedIn()) {
          writeLoginTried(false)
          const profile = await liff.getProfile()
          if (cancelled) return
          onUserIdReady?.(profile.userId)
          return
        }

        // 普通のブラウザで開かれた場合は、LINEログインを1回だけ挟む。
        // ただし次の場合は行わない:
        //  - LINEアプリの中（ログイン済みのはずで、ここに来るのは想定外）
        //  - このLIFFの範囲外の画面（400 Bad Request になるため）
        //  - すでに一度試した（ログインを断った場合に繰り返さない）
        //  - 先に人数選択を出した後（操作中に画面が切り替わらないように）
        const canLogin =
          !liff.isInClient() &&
          window.location.pathname.startsWith(LOGIN_PATH_PREFIX) &&
          !readLoginTried() &&
          !timedOut
        if (canLogin) {
          writeLoginTried(true)
          redirecting = true
          // 移動が進まないまま止まった場合は、LINE IDなしで先に進める
          loginTimer = setTimeout(proceed, LOGIN_REDIRECT_TIMEOUT_MS)
          liff.login({ redirectUri: window.location.href })
        }
      } catch {
        // LIFF失敗時はLINE IDなしでそのまま注文へ進む
      } finally {
        clearTimeout(timer)
        if (!redirecting) proceed()
      }
    }

    init()
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(loginTimer)
    }
  }, [tableId, onUserIdReady])

  // --- ローディング ---
  if (status === 'initializing') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-cream-50 p-8">
        <div className="w-10 h-10 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin" />
        <p className="text-brown-500 text-base">読み込み中...</p>
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
