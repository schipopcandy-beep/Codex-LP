'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatScheduleDate } from '@/lib/types'
import { useConfirm } from '@/components/admin/useConfirm'

interface Rule {
  key: string
  name: string
  enabled: boolean
  days_after: number
  text: string
  image_url: string | null
  preview_url: string | null
  enabled_from: string | null
  /** 明日の11時に送る予定の人数（目安。送らない設定なら null） */
  upcoming: number | null
  /** 直近30日に送れた数・送れなかった数 */
  sent30: number
  failed30: number
}

interface Draft {
  days_after: string
  text: string
  image_url: string | null
  preview_url: string | null
}

const draftOf = (r: Rule): Draft => ({
  days_after: String(r.days_after),
  text: r.text,
  image_url: r.image_url,
  preview_url: r.preview_url,
})

/**
 * 来店後のLINEメッセージ
 * 最後の来店から決めた日数がたったお客様に、毎日11時台にLINEを送る。
 * 来店 = LINEから注文して会計済みになった注文（テイクアウトは受け取り日）。同じ来店の分は1回だけ送る。
 */
export default function LineMessagesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [quota, setQuota] = useState<{ used: number; limit: number | null } | null>(null)
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messages', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '読み込めませんでした')
      setRules(data.rules)
      setQuota(data.quota)
      setDrafts(new Map((data.rules as Rule[]).map((r) => [r.key, draftOf(r)])))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const patch = async (key: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/messages/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? '保存できませんでした')
  }

  const toggle = async (rule: Rule) => {
    if (!rule.enabled) {
      const ok = await confirm(
        `「${rule.name}」を送るようにしますか？\n明日から、毎日11時台に自動で送ります。\n※ スプレッドシート（GAS）からも同じメッセージを送っている場合は、先にGASの自動実行を止めてください`,
        { confirmLabel: '送るようにする' },
      )
      if (!ok) return
    }
    setBusy(rule.key)
    try {
      await patch(rule.key, { enabled: !rule.enabled })
      await load()
    } catch (e) {
      alert((e as Error).message)
    }
    setBusy(null)
  }

  const save = async (rule: Rule) => {
    const draft = drafts.get(rule.key)
    if (!draft) return
    setBusy(rule.key)
    try {
      await patch(rule.key, {
        days_after: Number(draft.days_after),
        text: draft.text,
        image_url: draft.image_url,
        preview_url: draft.preview_url,
      })
      await load()
      setSaved(rule.key)
      setTimeout(() => setSaved(null), 2000)
    } catch (e) {
      alert((e as Error).message)
    }
    setBusy(null)
  }

  const setDraft = (key: string, change: Partial<Draft>) =>
    setDrafts((prev) => new Map(prev).set(key, { ...prev.get(key)!, ...change }))

  const uploadImage = async (key: string, file: File) => {
    setBusy(`image-${key}`)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/messages/image', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '写真を保存できませんでした')
      setDraft(key, { image_url: data.image_url, preview_url: data.preview_url })
    } catch (e) {
      alert((e as Error).message)
    }
    setBusy(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="space-y-2">
        <h1 className="section-title">LINEメッセージ</h1>
        <div className="card p-3 text-sm text-brown-600 space-y-1 leading-relaxed">
          <p>
            最後の来店から決めた日数がたったお客様に、<span className="font-bold">毎日11時台</span>
            に自動でLINEを送ります。
          </p>
          <p className="text-xs text-brown-500">
            来店 = LINEから注文して会計済みになった注文（テイクアウトは受け取り日）。同じ来店の分は1回だけ送ります。
            その日数のあいだにまた来店すると、新しい来店日から数え直します。
          </p>
        </div>
        {quota && (
          <p className="text-sm text-brown-600">
            今月の送信数：
            <span className="font-bold tabular-nums">{quota.used.toLocaleString()}</span>
            {quota.limit != null ? (
              <>
                {' '}/ 上限 <span className="tabular-nums">{quota.limit.toLocaleString()}</span>通
                {quota.used >= quota.limit * 0.8 && (
                  <span className="ml-2 font-bold text-red-600">上限が近づいています</span>
                )}
              </>
            ) : (
              '通'
            )}
            <span className="block text-xs text-brown-400">テイクアウトの確認・順番待ちのお知らせなども含めた、お店のLINE全体の数です</span>
          </p>
        )}
      </div>

      {error && <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
      {loading && <p className="text-center text-brown-400 py-10">読み込み中...</p>}

      {rules.map((rule) => {
        const draft = drafts.get(rule.key) ?? draftOf(rule)
        const changed =
          draft.days_after !== String(rule.days_after) ||
          draft.text !== rule.text ||
          draft.image_url !== rule.image_url
        const ruleBusy = busy === rule.key
        return (
          <section key={rule.key} className={`card p-4 space-y-3 ${rule.enabled ? 'border-2 border-matcha-500' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg text-brown-800">{rule.name}</h2>
                <p className="text-xs text-brown-500">
                  {rule.enabled
                    ? `送っています（明日の予定 ${rule.upcoming ?? 0}人・直近30日 ${rule.sent30}通${rule.failed30 > 0 ? `・送れなかった ${rule.failed30}件` : ''}）`
                    : '送っていません'}
                  {rule.enabled && rule.enabled_from && `　${formatScheduleDate(rule.enabled_from)}から開始`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(rule)}
                disabled={ruleBusy}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-bold border disabled:opacity-50 ${
                  rule.enabled
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-white text-brown-500 border-cream-300'
                }`}
              >
                {ruleBusy ? '...' : rule.enabled ? '送る：ON' : '送る：OFF'}
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-brown-700">
              最後の来店から
              <input
                type="number"
                min={1}
                max={365}
                value={draft.days_after}
                onChange={(e) => setDraft(rule.key, { days_after: e.target.value })}
                className="w-20 rounded-lg border border-cream-300 bg-white px-2 py-1 text-right tabular-nums"
              />
              日後に送る
            </label>

            <label className="block">
              <span className="block text-sm font-semibold text-brown-600 mb-1">メッセージ</span>
              <textarea
                value={draft.text}
                onChange={(e) => setDraft(rule.key, { text: e.target.value })}
                rows={7}
                maxLength={2000}
                className="w-full rounded-xl border-2 border-brown-300 bg-white px-3 py-2 text-base leading-relaxed"
              />
            </label>

            <div className="space-y-2">
              <span className="block text-sm font-semibold text-brown-600">写真（任意。文章のあとに送ります）</span>
              {draft.image_url ? (
                <div className="flex items-end gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.preview_url ?? draft.image_url}
                    alt="送る写真"
                    className="w-32 h-32 object-cover rounded-xl border border-cream-300 bg-cream-100"
                  />
                  <button
                    type="button"
                    onClick={() => setDraft(rule.key, { image_url: null, preview_url: null })}
                    className="text-xs text-brown-400 underline underline-offset-2"
                  >
                    写真を外す
                  </button>
                </div>
              ) : (
                <p className="text-xs text-brown-400">写真なし</p>
              )}
              <label className="inline-block px-3 py-2 rounded-xl border border-cream-300 bg-white text-sm font-bold text-brown-700 cursor-pointer">
                {busy === `image-${rule.key}` ? '保存中...' : draft.image_url ? '写真を変える' : '写真を選ぶ'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy === `image-${rule.key}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadImage(rule.key, file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => save(rule)}
                disabled={!changed || ruleBusy}
                className="btn-primary px-6 py-2 disabled:opacity-40"
              >
                {ruleBusy ? '保存中...' : '保存する'}
              </button>
              {changed && <span className="text-xs text-amber-700 font-bold">保存していない変更があります</span>}
              {saved === rule.key && <span className="text-sm text-matcha-600 font-bold">保存しました</span>}
            </div>
          </section>
        )
      })}
      {confirmDialog}
    </div>
  )
}
