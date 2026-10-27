'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { storageUrl } from '@/lib/types'

/** ログイン後に開く画面（管理画面の中だけ。ほかのサイトへは飛ばさない） */
function nextPath(next: string | null): string {
  return next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin'
}

function LoginForm() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'ログインできませんでした')
      // 画面ごと開き直して、ログインの印を使って読み込む
      window.location.href = nextPath(searchParams.get('next'))
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-4">
      <h1 className="section-title text-center">管理画面ログイン</h1>
      <label className="block">
        <span className="block text-sm font-semibold text-brown-600 mb-1">パスワード</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          className="w-full rounded-xl border-2 border-brown-300 bg-white px-3 py-3 text-base"
        />
      </label>
      {error && <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
      <button type="submit" disabled={!password || submitting} className="btn-primary w-full py-3 disabled:opacity-40">
        {submitting ? '確認中...' : 'ログイン'}
      </button>
      <p className="text-xs text-brown-400 text-center">この端末では30日間ログインしたままになります</p>
    </form>
  )
}

/** 管理画面のログイン */
export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-cream-50 flex flex-col items-center justify-center px-4 gap-6">
      <Image src={storageUrl('logo.png')} alt="織はや" width={120} height={48} className="object-contain h-12 w-auto" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
