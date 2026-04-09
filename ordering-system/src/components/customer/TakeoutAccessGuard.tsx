'use client'

import { useEffect, useState } from 'react'

interface Props {
  onUserIdReady?: (userId: string) => void
  children: React.ReactNode
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

/**
 * テイクアウト専用の軽量LIFFガード。
 * 友だちチェックは行わず、LIFF認証でLINE IDを取得したらすぐ注文画面を表示する。
 * LIFF未設定・認証失敗の場合も注文画面を表示（LINE IDなしで注文可能）。
 */
export default function TakeoutAccessGuard({ onUserIdReady, children }: Props) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!LIFF_ID) {
      setReady(true)
      return
    }

    let cancelled = false

    const init = async () => {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: LIFF_ID })

        if (cancelled) return

        if (!liff.isLoggedIn()) {
          // 外部ブラウザでログイン未済の場合はリダイレクト
          if (!liff.isInClient()) {
            liff.login({ redirectUri: window.location.href })
            return
          }
        }

        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile()
          if (!cancelled) onUserIdReady?.(profile.userId)
        }
      } catch {
        // LIFF失敗してもそのまま注文画面を表示
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    init()
    return () => { cancelled = true }
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
