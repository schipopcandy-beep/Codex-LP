'use client'

import { useCallback, useRef, useState } from 'react'

interface ConfirmOptions {
  /** 実行するボタンの文言（既定: 「はい」） */
  confirmLabel?: string
  /** 取り消しや削除など、注意が必要な操作か（ボタンを赤くする） */
  danger?: boolean
}

/**
 * 画面の中に出す確認ダイアログ
 *
 * ブラウザ標準の confirm() は、端末や設定によっては表示されずに自動で
 * 「キャンセル」扱いになる（「このページでダイアログを表示しない」を選んだ場合や、
 * ホーム画面に追加したWebアプリなど）。その場合、ボタンを押しても何も起きないため、
 * 確認はすべてこちらを使う。
 *
 * 使い方:
 *   const [confirm, confirmDialog] = useConfirm()
 *   if (!(await confirm('会計済みにしますか？'))) return
 *   ...
 *   return <>{...}{confirmDialog}</>
 */
export function useConfirm(): [(message: string, options?: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [state, setState] = useState<{ message: string; options: ConfirmOptions } | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setState({ message, options })
    })
  }, [])

  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setState(null)
  }

  const dialog = state ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm rounded-2xl bg-cream-50 p-6 shadow-2xl space-y-5">
        <p className="text-lg font-bold text-brown-800 text-center whitespace-pre-line">{state.message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="flex-1 py-3 rounded-xl border border-cream-300 bg-white text-brown-600 font-bold"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`flex-1 py-3 rounded-xl font-bold text-white ${
              state.options.danger ? 'bg-red-600 active:bg-red-700' : 'bg-brown-600 active:bg-brown-700'
            }`}
          >
            {state.options.confirmLabel ?? 'はい'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return [confirm, dialog]
}
