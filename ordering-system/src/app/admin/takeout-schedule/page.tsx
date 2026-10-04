'use client'

import { useCallback, useEffect, useState } from 'react'
import { WEEKDAY_NAMES, type EffectiveDay, type WeeklyHours } from '@/lib/business-hours'

type DaySchedule = EffectiveDay & { label: string }

/** 営業・休業の切り替えスイッチ */
function OpenToggle({ isOpen, onChange }: { isOpen: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!isOpen)}
      className="flex items-center gap-2 select-none"
      aria-pressed={isOpen}
    >
      <span className={`text-sm font-semibold ${isOpen ? 'text-matcha-600' : 'text-brown-400'}`}>
        {isOpen ? '営業' : '休業'}
      </span>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors ${
          isOpen ? 'bg-matcha-500' : 'bg-brown-300'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            isOpen ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

/** 開始・終了時刻の入力 */
function TimeRange({
  open,
  close,
  onChange,
}: {
  open: string
  close: string
  onChange: (patch: { open_time?: string; close_time?: string }) => void
}) {
  const inputClass = 'border border-cream-300 rounded-lg px-2 py-1 text-brown-800 text-sm bg-white'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="time"
        value={open}
        onChange={(e) => onChange({ open_time: e.target.value })}
        className={inputClass}
        aria-label="開始"
      />
      <span className="text-brown-400">〜</span>
      <input
        type="time"
        value={close}
        onChange={(e) => onChange({ close_time: e.target.value })}
        className={inputClass}
        aria-label="終了"
      />
    </div>
  )
}

/**
 * 営業日・営業時間の管理
 * - 曜日ごとの設定（定休日・ふだんの営業時間）
 * - 日付ごとの設定（臨時休業・時間変更）。曜日の設定より優先される
 * 休業の日は、テイクアウトの受け取り日として選べなくなる。
 */
export default function BusinessDaysPage() {
  const [weekly, setWeekly] = useState<WeeklyHours[]>([])
  const [days, setDays] = useState<DaySchedule[]>([])
  const [local, setLocal] = useState<Map<string, DaySchedule>>(new Map())
  const [loading, setLoading] = useState(true)
  const [savingWeekly, setSavingWeekly] = useState(false)
  const [busyDate, setBusyDate] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/takeout-schedule')
    const data: { weekly: WeeklyHours[]; days: DaySchedule[] } = await res.json()
    setWeekly(data.weekly)
    setDays(data.days)
    setLocal(new Map(data.days.map((d) => [d.date, { ...d }])))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flash = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(null), 2500)
  }

  const updateWeekly = (weekday: number, patch: Partial<WeeklyHours>) => {
    setWeekly((prev) => prev.map((w) => (w.weekday === weekday ? { ...w, ...patch } : w)))
  }

  const saveWeekly = async () => {
    setSavingWeekly(true)
    try {
      const res = await fetch('/api/admin/takeout-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '保存に失敗しました')
      }
      await load()
      flash('曜日ごとの設定を保存しました')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSavingWeekly(false)
    }
  }

  const updateDay = (date: string, patch: Partial<DaySchedule>) => {
    setLocal((prev) => {
      const next = new Map(prev)
      const cur = next.get(date)
      if (cur) next.set(date, { ...cur, ...patch })
      return next
    })
  }

  const saveDay = async (date: string) => {
    const d = local.get(date)
    if (!d) return
    setBusyDate(date)
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
      await load()
      flash(`${d.label}を保存しました`)
    } catch {
      alert('保存に失敗しました')
    } finally {
      setBusyDate(null)
    }
  }

  const resetDay = async (date: string, label: string) => {
    setBusyDate(date)
    try {
      const res = await fetch(`/api/admin/takeout-schedule?date=${encodeURIComponent(date)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      await load()
      flash(`${label}を曜日の設定に戻しました`)
    } catch {
      alert('変更に失敗しました')
    } finally {
      setBusyDate(null)
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
      <h1 className="section-title mb-1">営業日・営業時間</h1>
      <p className="text-sm text-brown-500 mb-5">
        休業の日は、テイクアウトの受け取り日として選べなくなります。営業時間はテイクアウトの受け取り時間に使われます。
      </p>

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-300 text-sm text-brown-800">
          {message}
        </div>
      )}

      {/* 曜日ごとの設定 */}
      <section className="card p-4 mb-6 space-y-3">
        <div>
          <h2 className="font-bold text-brown-800">曜日ごとの設定（毎週）</h2>
          <p className="text-xs text-brown-400">定休日やふだんの営業時間を設定します</p>
        </div>
        {weekly.map((w) => (
          <div
            key={w.weekday}
            className="flex items-center justify-between gap-3 flex-wrap border-b border-cream-200 pb-3 last:border-b-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 font-bold text-brown-800">{WEEKDAY_NAMES[w.weekday]}</span>
              <OpenToggle isOpen={w.is_open} onChange={(v) => updateWeekly(w.weekday, { is_open: v })} />
            </div>
            {w.is_open && (
              <TimeRange
                open={w.open_time}
                close={w.close_time}
                onChange={(patch) => updateWeekly(w.weekday, patch)}
              />
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={saveWeekly}
          disabled={savingWeekly}
          className="btn-primary w-full py-2 text-sm disabled:opacity-50"
        >
          {savingWeekly ? '保存中...' : '曜日ごとの設定を保存する'}
        </button>
      </section>

      {/* 日付ごとの設定 */}
      <section>
        <h2 className="font-bold text-brown-800">日付ごとの設定（臨時休業・時間変更）</h2>
        <p className="text-xs text-brown-400 mb-3">
          特定の日だけ休みにしたり、時間を変えたりできます。曜日ごとの設定より優先されます。
        </p>

        <div className="space-y-3">
          {days.map((day) => {
            const d = local.get(day.date) ?? day
            const busy = busyDate === day.date
            return (
              <div key={day.date} className={`card p-4 space-y-3 ${!day.is_open ? 'bg-cream-100' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-brown-800">{day.label}</p>
                    {day.is_custom && (
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                        個別設定
                      </span>
                    )}
                  </div>
                  <OpenToggle isOpen={d.is_open} onChange={(v) => updateDay(day.date, { is_open: v })} />
                </div>

                {d.is_open && (
                  <TimeRange
                    open={d.open_time}
                    close={d.close_time}
                    onChange={(patch) => updateDay(day.date, patch)}
                  />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveDay(day.date)}
                    disabled={busy}
                    className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
                  >
                    {busy ? '保存中...' : 'この日を保存する'}
                  </button>
                  {day.is_custom && (
                    <button
                      type="button"
                      onClick={() => resetDay(day.date, day.label)}
                      disabled={busy}
                      className="px-3 py-2 rounded-xl text-sm font-semibold border border-cream-300 text-brown-600 bg-white disabled:opacity-50"
                    >
                      曜日の設定に戻す
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
