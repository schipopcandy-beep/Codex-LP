'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Order, OrderMessage } from '@/lib/types'

/** よく使う文面 */
const TEMPLATES: { label: string; text: string }[] = [
  {
    label: 'ご注文の確認',
    text: '織はやです。テイクアウト注文ありがとうございます！\nご注文について確認したいことがございます。このチャットにご返信お願いできますか？',
  },
]

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })

/**
 * 注文カードの「LINEで連絡」
 * LINEから注文したお客様に、お店のLINEからメッセージを送る。送った記録はカードに出す。
 * お客様が返信すると、LINE公式アカウントのチャットに出てくるので、続きはそちらでやり取りする。
 *
 * 注文カードの下（リンクの外）に置く。ダイアログでの操作は、カードのドラッグに伝わらないよう止めている
 */
export default function LineContactButton({ order }: { order: Order }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(TEMPLATES[0].text)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 送ったものはすぐ出す（次の取り直しまで待たない）
  const [sent, setSent] = useState<OrderMessage[]>([])

  if (!order.line_user_id) return null

  const messages = [...(order.order_messages ?? []), ...sent.filter((s) => !order.order_messages?.some((m) => m.id === s.id))]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data: { error?: string; message?: OrderMessage | null } = await res.json().catch(() => ({}))
      if (data.message) setSent((prev) => [...prev, data.message!])
      if (!res.ok) throw new Error(data.error ?? '送れませんでした')
      setOpen(false)
      setText(TEMPLATES[0].text)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className="px-3 py-1.5 rounded-lg bg-[#06C755] text-white text-sm font-bold active:opacity-80"
      >
        💬 LINEで連絡
      </button>
      {messages.map((m) => (
        <p key={m.id} className={`text-xs ${m.ok ? 'text-matcha-700' : 'text-red-600'}`}>
          💬 {timeOf(m.created_at)} {m.ok ? '送信済み' : '送れませんでした'}
        </p>
      ))}

      {open &&
        createPortal(
          // 画面の上に出すが、操作が注文カードのドラッグ・クリックに伝わらないよう止める
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => !sending && setOpen(false)} />
            <div className="relative w-full max-w-md rounded-2xl bg-cream-50 p-5 shadow-2xl space-y-4">
              <p className="text-lg font-bold text-brown-800">{order.customer_name ?? 'お客様'} 様にLINEを送る</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-brown-500 self-center">よく使う文面：</span>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setText(t.text)}
                    className="px-3 py-1.5 rounded-lg border border-cream-300 bg-white text-sm font-bold text-brown-700"
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="px-3 py-1.5 rounded-lg border border-cream-300 bg-white text-sm font-bold text-brown-700"
                >
                  自由に書く
                </button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                maxLength={1000}
                className="w-full rounded-xl border-2 border-brown-300 bg-white px-3 py-2 text-base leading-relaxed"
              />
              <p className="text-xs text-brown-400 leading-relaxed">
                お店のLINEから送られます。お客様が返信すると、LINE公式アカウントのチャットに出てきます。
              </p>
              {error && <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  className="flex-1 py-3 rounded-xl border border-cream-300 bg-white text-brown-600 font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={!text.trim() || sending}
                  className="flex-1 py-3 rounded-xl bg-[#06C755] text-white font-bold disabled:opacity-40"
                >
                  {sending ? '送信中...' : '送信する'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
