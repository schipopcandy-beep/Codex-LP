'use client'

import { useEffect, useState } from 'react'

interface Props {
  onUserIdReady?: (userId: string) => void
  children: React.ReactNode
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

/**
 * LINEの初期化を待つ上限（ミリ秒）
 * その日最初の起動などでLINE側の応答が返らないことがあり、再読み込みすると
 * 進めるため、上限を過ぎたら再読み込みで立て直す。
 */
const LIFF_TIMEOUT_MS = 6000

/** 自動の再読み込みを一度だけにするための sessionStorage キー */
const AUTO_RELOAD_KEY = 'orihaya-takeout-auto-reloaded'

type GuardState =
  | 'loading'    // LINEの初期化中
  | 'reloading'  // 応答がないため自動で再読み込み中
  | 'stuck'      // 自動の再読み込み後も応答がない
  | 'ready'

function readAutoReloaded(): boolean {
  try {
    return sessionStorage.getItem(AUTO_RELOAD_KEY) === '1'
  } catch {
    return false
  }
}

function writeAutoReloaded(value: boolean) {
  try {
    if (value) sessionStorage.setItem(AUTO_RELOAD_KEY, '1')
    else sessionStorage.removeItem(AUTO_RELOAD_KEY)
  } catch {
    // 保存できない環境では、自動の再読み込みを繰り返さないことだけ保証できればよい
  }
}

/**
 * テイクアウト専用のLIFFガード。
 * 注文後の確認メッセージをLINEで送るため、LINE IDが取れるまで注文画面を出さない。
 * LINEの応答が返らない場合は、まず自動で1回再読み込みし、それでも駄目なら
 * 再読み込みボタンを出す。
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

    const finish = () => {
      if (cancelled) return
      settled = true
      clearTimeout(timer)
      writeAutoReloaded(false)
      setState('ready')
    }

    const timer = setTimeout(() => {
      if (cancelled || settled) return
      if (!readAutoReloaded()) {
        writeAutoReloaded(true)
        setState('reloading')
        window.location.reload()
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
          // 外部ブラウザでログイン未済の場合はLINEログインへ
          settled = true
          clearTimeout(timer)
          liff.login({ redirectUri: window.location.href })
          return
        }

        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          if (!cancelled) onUserIdReady?.(profile.userId)
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
            onClick={() => window.location.reload()}
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
