'use client'

import { useEffect, useState } from 'react'

interface Props {
  /** LINE IDと表示名が取れたら呼ばれる（表示名は注文者名の初期値に使う） */
  onUserIdReady?: (userId: string, displayName?: string) => void
  children: React.ReactNode
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

/**
 * LINEの初期化を待つ上限（ミリ秒）
 * 保存していたLINEのログインが期限切れ（約12時間）になると、応答が返らず
 * 止まることがある。開き直すと進めるため、上限を過ぎたらLIFFのURLから開き直す。
 */
const LIFF_TIMEOUT_MS = 6000

/** LINEログイン画面への移動を待つ上限（ミリ秒）。過ぎたら開き直しの案内を出す */
const LOGIN_REDIRECT_TIMEOUT_MS = 12000

/**
 * LIFFのURL。LINEアプリの中ではアプリが毎回ログイン情報を渡すため、
 * 期限切れのログインで止まらない。エンドポイントが /takeout なのでパスは付けない
 */
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`

/** 自動で開き直した時刻。短時間に繰り返し開き直さないために使う */
const AUTO_RETRY_KEY = 'orihaya-takeout-retried-at'
const AUTO_RETRY_INTERVAL_MS = 2 * 60 * 1000

type GuardState =
  | 'loading'    // LINEの初期化中
  | 'reloading'  // 応答がないため自動で開き直し中
  | 'stuck'      // 開き直した後も応答がない
  | 'ready'

/** 直近に自動で開き直していなければ true */
function canAutoRetry(): boolean {
  try {
    const last = Number(localStorage.getItem(AUTO_RETRY_KEY) ?? 0)
    return Date.now() - last > AUTO_RETRY_INTERVAL_MS
  } catch {
    return false
  }
}

function markAutoRetried(value: boolean) {
  try {
    if (value) localStorage.setItem(AUTO_RETRY_KEY, String(Date.now()))
    else localStorage.removeItem(AUTO_RETRY_KEY)
  } catch {
    // 保存できない環境では自動で開き直さない（canAutoRetry が false を返す）
  }
}

/** LIFFのURLから開き直す（お客様が画面を開き直すのと同じ動き） */
function reopenViaLiff() {
  window.location.href = LIFF_URL
}

/**
 * テイクアウト専用のLIFFガード。
 * 注文後の確認メッセージをLINEで送るため、LINE IDが取れるまで注文画面を出さない。
 * LINEの応答が返らない場合は、まず自動でLIFFのURLから開き直し、
 * それでも駄目なら再読み込みボタンを出す。
 */
export default function TakeoutAccessGuard({ onUserIdReady, children }: Props) {
  const [state, setState] = useState<GuardState>('loading')

  useEffect(() => {
    if (!LIFF_ID) {
      setState('ready')
      return
    }

    let cancelled = false
    let settled = false

    let loginTimer: ReturnType<typeof setTimeout> | undefined

    const finish = () => {
      if (cancelled) return
      settled = true
      clearTimeout(timer)
      markAutoRetried(false)
      setState('ready')
    }

    const timer = setTimeout(() => {
      if (cancelled || settled) return
      if (canAutoRetry()) {
        markAutoRetried(true)
        setState('reloading')
        reopenViaLiff()
      } else {
        // 画面を出したまま初期化は続け、完了すれば注文画面へ進む
        setState('stuck')
      }
    }, LIFF_TIMEOUT_MS)

    const init = async () => {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: LIFF_ID })

        if (cancelled) return

        if (!liff.isLoggedIn() && !liff.isInClient()) {
          // 外部ブラウザでログイン未済の場合はLINEログインへ。
          // 移動が進まないまま止まった場合は、開き直しの案内を出す
          settled = true
          clearTimeout(timer)
          loginTimer = setTimeout(() => {
            if (!cancelled) setState('stuck')
          }, LOGIN_REDIRECT_TIMEOUT_MS)
          liff.login({ redirectUri: window.location.href })
          return
        }

        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          if (!cancelled) onUserIdReady?.(profile.userId, profile.displayName)
        }
        finish()
      } catch {
        // LIFFの設定不備などで失敗した場合は、再読み込みしても直らないため注文画面を出す
        finish()
      }
    }

    init()
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(loginTimer)
    }
  }, [onUserIdReady])

  if (state === 'stuck') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-cream-50">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 space-y-5 text-center">
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-brown-800">LINEとの接続に時間がかかっています</h1>
            <p className="text-sm text-brown-500 leading-relaxed">
              ご注文の確認メッセージをLINEでお送りするため、LINEとの接続が必要です。
              お手数ですが、再読み込みをお願いします。
            </p>
          </div>
          <button
            type="button"
            onClick={reopenViaLiff}
            className="btn-primary w-full py-3 text-base"
          >
            再読み込みする
          </button>
          <button
            type="button"
            onClick={() => setState('ready')}
            className="w-full py-2 text-xs text-brown-400 underline underline-offset-2"
          >
            確認メッセージなしで注文する
          </button>
        </div>
      </div>
    )
  }

  if (state !== 'ready') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-cream-50">
        <div className="w-10 h-10 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin" />
        <p className="text-brown-500 text-base">
          {state === 'reloading' ? '再読み込みしています...' : '読み込み中...'}
        </p>
      </div>
    )
  }

  return <>{children}</>
}
