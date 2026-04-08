'use client'

import { useEffect, useState } from 'react'
import { TAKEOUT_DEFAULT_OPEN, TAKEOUT_DEFAULT_CLOSE } from '@/lib/types'

interface DaySchedule {
  date: string
  label: string
  is_open: boolean
  open_time: string
  close_time: string
  is_custom: boolean
}

export default function TakeoutSchedulePage() {
  const [days, setDays] = useState<DaySchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // 保存中の date
  const [saved, setSaved] = useState<string | null>(null)   // 保存完了の date
  const [local, setLocal] = useState<Map<string, DaySchedule>>(new Map())

  useEffect(() => {
    fetch('/api/admin/takeout-schedule')
      .then((r) => r.json())
      .then((data: DaySchedule[]) => {
        setDays(data)
        setLocal(new Map(data.map((d) => [d.date, { ...d }])))
        setLoading(false)
      })
  }, [])

  const update = (date: string, patch: Partial<DaySchedule>) => {
    setLocal((prev) => {
      const next = new Map(prev)
      const cur = next.get(date)
      if (cur) next.set(date, { ...cur, ...patch })
      return next
    })
  }

  const save = async (date: string) => {
    const d = local.get(date)
    if (!d) return
    setSaving(date)
    try {
      const res = await fetch('/api/admin/takeout-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: d.date,
          is_open: d.is_open,
          open_time: d.open_time,
          close_time: d.close_time,
        }),
      })
      if (!res.ok) throw new Error()
      setSaved(date)
      setTimeout(() => setSaved(null), 2000)
    } catch {
      alert('保存に失敗しました')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-brown-400">
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="section-title mb-1">受取日時 管理</h1>
      <p className="text-sm text-brown-400 mb-5">
        デフォルト営業時間: {TAKEOUT_DEFAULT_OPEN} 〜 {TAKEOUT_DEFAULT_CLOSE}（設定なしの日はこの時間で表示されます）
      </p>

      <div className="space-y-3">
        {days.map((day) => {
          const d = local.get(day.date) ?? day
          const isSaving = saving === day.date
          const isSaved = saved === day.date

          return (
            <div key={day.date} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-brown-800">{day.label}</p>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className={`text-sm font-semibold ${d.is_open ? 'text-matcha-600' : 'text-brown-400'}`}>
                    {d.is_open ? '営業' : '休業'}
                  </span>
                  <div
                    onClick={() => update(day.date, { is_open: !d.is_open })}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                      d.is_open ? 'bg-matcha-500' : 'bg-brown-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        d.is_open ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </label>
              </div>

              {d.is_open && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-brown-500">開始</label>
                    <input
                      type="time"
                      value={d.open_time}
                      onChange={(e) => update(day.date, { open_time: e.target.value })}
                      className="border border-cream-300 rounded-lg px-2 py-1 text-brown-800 text-sm bg-white"
                    />
                  </div>
                  <span className="text-brown-400">〜</span>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-brown-500">終了</label>
                    <input
                      type="time"
                      value={d.close_time}
                      onChange={(e) => update(day.date, { close_time: e.target.value })}
                      className="border border-cream-300 rounded-lg px-2 py-1 text-brown-800 text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => save(day.date)}
                disabled={isSaving}
                className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
                  isSaved
                    ? 'bg-matcha-100 text-matcha-700 border border-matcha-300'
                    : 'btn-primary'
                } disabled:opacity-50`}
              >
                {isSaving ? '保存中...' : isSaved ? '保存しました ✓' : '保存する'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
