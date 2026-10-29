'use client'

import { useEffect, useRef } from 'react'

/**
 * 一定の間隔で fn を呼ぶ（画面の取り直し用）
 * 画面が裏に回っている間（別のタブ・アプリ・画面オフ）は呼ばず、表に戻ったときにすぐ1回呼ぶ。
 * 開きっぱなしの端末がデータベースを読み続けないようにするため
 * pauseWhenHidden を false にすると、裏にある間も呼ぶ（注文のお知らせ音など、裏でも動かしたいもの）
 */
export function usePolling(fn: () => void, intervalMs: number, enabled = true, pauseWhenHidden = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      if (!pauseWhenHidden || document.visibilityState === 'visible') fnRef.current()
    }, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fnRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs, enabled, pauseWhenHidden])
}
