'use client'

import { useEffect, useState } from 'react'

interface Props {
  onUserIdReady?: (userId: string) => void
  children: React.ReactNode
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

/**
 * LINEの初期化を待つ上限（ミリ秒）
 * その日最初の起動などでLINE側の応答が返らないことがあり、待ち続けると
 * 「読み込み中」のまま進まなくなるため、上限を過ぎたら注文画面を先に出す。
 */
const LIFF_TIMEOUT_MS = 5000

/**
 * テイクアウト専用の軽量LIFFガード。
 * 友だちチェックは行わず、LIFF認証でLINE IDを取得したらすぐ注文画面を表示する。
 * LIFF未設定・認証失敗・応答待ちが長い場合も注文画面を表示（LINE IDなしで注文可能）。
 */
export default function TakeoutAccessGuard({ onUserIdReady, children }: Props) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!LIFF_ID) {
      setReady(true)
      return
    }

    let cancelled = false
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      if (!cancelled) setReady(true)
    }, LIFF_TIMEOUT_MS)

    const init = async () => {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: LIFF_ID })

        if (cancelled) return

        if (!liff.isLoggedIn()) {
          // 外部ブラウザでログイン未済の場合はリダイレクト。
          // ただし先に注文画面を出した後は、操作中に画面が切り替わらないよう行わない
          if (!liff.isInClient() && !timedOut) {
            liff.login({ redirectUri: window.location.href })
            return
          }
        }

        // 注文画面を先に出した後でも、IDが取れれば通知に使えるよう渡す
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          if (!cancelled) onUserIdReady?.(profile.userId)
        }
      } catch {
        // LIFF失敗してもそのまま注文画面を表示
      } finally {
        clearTimeout(timer)
        if (!cancelled) setReady(true)
      }
    }

    init()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [onUserIdReady])

  if (!ready) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-cream-50">
        <div className="w-10 h-10 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin" />
        <p className="text-brown-500 text-base">読み込み中...</p>
      </div>
    )
  }

  return <>{children}</>
}
