'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Event {
  id: string
  name: string
  date: string
  end_date: string | null
  location: string | null
  scale: number
  note: string | null
}

const SCALE_LABELS: Record<number, string> = {
  1: '小規模',
  2: '中小規模',
  3: '中規模',
  4: '大規模',
  5: '超大規模',
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', date: '', end_date: '', location: '', scale: 3, note: '' })

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/events')
    if (res.ok) setEvents(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const submit = async () => {
    if (!form.name || !form.date) return
    setSaving(true)
    await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        date: form.date,
        end_date: form.end_date || null,
        location: form.location || null,
        scale: form.scale,
        note: form.note || null,
      }),
    })
    setForm({ name: '', date: '', end_date: '', location: '', scale: 3, note: '' })
    setShowForm(false)
    await fetchEvents()
    setSaving(false)
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
    await fetchEvents()
  }

  const jstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  const upcoming = events.filter((e) => (e.end_date ?? e.date) >= jstToday)
  const past     = events.filter((e) => (e.end_date ?? e.date) < jstToday)

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-brown-500 hover:text-brown-700 text-base">← 一覧</Link>
        <h1 className="section-title text-2xl">イベント管理</h1>
      </div>

      {/* 追加フォーム */}
      <div className="card p-4 mb-5">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-between text-brown-700 font-bold"
        >
          <span>＋ イベントを追加</span>
          <span>{showForm ? '▲' : '▼'}</span>
        </button>

        {showForm && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-brown-500 font-medium block mb-1">イベント名 *</label>
              <input
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm bg-cream-50 focus:outline-none focus:border-brown-400"
                placeholder="例：仙台七夕まつり"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-brown-500 font-medium block mb-1">開始日 *</label>
                <input
                  type="date"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm bg-cream-50 focus:outline-none focus:border-brown-400"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-brown-500 font-medium block mb-1">終了日（任意）</label>
                <input
                  type="date"
                  className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm bg-cream-50 focus:outline-none focus:border-brown-400"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-brown-500 font-medium block mb-1">場所（任意）</label>
              <input
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm bg-cream-50 focus:outline-none focus:border-brown-400"
                placeholder="例：勾当台公園"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-brown-500 font-medium block mb-1">規模</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, scale: s })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      form.scale === s
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-cream-100 text-brown-600 border-cream-300 hover:bg-cream-200'
                    }`}
                  >
                    {'★'.repeat(s)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-brown-400 mt-1">{SCALE_LABELS[form.scale]}</p>
            </div>
            <button
              onClick={submit}
              disabled={saving || !form.name || !form.date}
              className="w-full py-2 bg-brown-600 text-white font-bold rounded-xl text-sm hover:bg-brown-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '追加する'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-brown-400">読み込み中...</div>
      ) : (
        <div className="space-y-5">
          {/* 今後・開催中 */}
          {upcoming.length > 0 && (
            <div className="card p-4">
              <h2 className="font-bold text-brown-700 mb-3">今後・開催中</h2>
              <div className="space-y-3">
                {upcoming.map((e) => <EventRow key={e.id} event={e} onDelete={deleteEvent} onSave={fetchEvents} />)}
              </div>
            </div>
          )}

          {/* 過去 */}
          {past.length > 0 && (
            <div className="card p-4">
              <h2 className="font-bold text-brown-700 mb-3 text-sm opacity-70">過去のイベント</h2>
              <div className="space-y-3 opacity-60">
                {past.map((e) => <EventRow key={e.id} event={e} onDelete={deleteEvent} onSave={fetchEvents} />)}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <p className="text-center text-brown-400 py-8">イベントが登録されていません</p>
          )}
        </div>
      )}
    </div>
  )
}

function EventRow({
  event,
  onDelete,
  onSave,
}: {
  event: Event
  onDelete: (id: string) => void
  onSave: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: event.name,
    date: event.date,
    end_date: event.end_date ?? '',
    location: event.location ?? '',
    scale: event.scale,
    note: event.note ?? '',
  })
  const startEdit = () => {
    setForm({ name: event.name, date: event.date, end_date: event.end_date ?? '', location: event.location ?? '', scale: event.scale, note: event.note ?? '' })
    setEditing(true)
  }

  const save = async () => {
    if (!form.name || !form.date) return
    setSaving(true)
    await fetch(`/api/admin/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, end_date: form.end_date || null, location: form.location || null, note: form.note || null }),
    })
    setSaving(false)
    setEditing(false)
    onSave()
  }

  const dateLabel = event.end_date && event.end_date !== event.date
    ? `${event.date} 〜 ${event.end_date}`
    : event.date

  if (editing) {
    return (
      <div className="border border-brown-300 rounded-xl p-3 space-y-2 bg-cream-100">
        <input
          className="w-full border border-cream-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brown-400"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="イベント名"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className="border border-cream-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brown-400"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <input
            type="date"
            className="border border-cream-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brown-400"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            placeholder="終了日（任意）"
          />
        </div>
        <input
          className="w-full border border-cream-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brown-400"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="場所（任意）"
        />
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setForm({ ...form, scale: s })}
              className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-colors ${
                form.scale === s
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-cream-100 text-brown-600 border-cream-300 hover:bg-cream-200'
              }`}
            >
              {'★'.repeat(s)}
            </button>
          ))}
        </div>
        <textarea
          className="w-full border border-cream-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-brown-400 resize-none"
          rows={2}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="コメント（任意）"
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !form.name || !form.date}
            className="flex-1 py-1.5 bg-brown-600 text-white font-bold rounded-lg text-sm hover:bg-brown-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-1.5 border border-cream-300 text-brown-500 rounded-lg text-sm hover:bg-cream-100 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <span className="text-xl shrink-0 mt-0.5">🎪</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-brown-800 text-sm">{event.name}</p>
        <p className="text-xs text-brown-500 mt-0.5">
          {dateLabel}
          {event.location && <span className="ml-2">📍{event.location}</span>}
        </p>
        {event.note && <p className="text-xs text-brown-400 mt-0.5 leading-relaxed">{event.note}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-amber-400 text-xs">{'★'.repeat(event.scale)}</span>
        <button
          onClick={startEdit}
          className="text-xs text-brown-400 hover:text-brown-600 px-2 py-1 rounded transition-colors"
        >
          編集
        </button>
        <button
          onClick={() => onDelete(event.id)}
          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  )
}
