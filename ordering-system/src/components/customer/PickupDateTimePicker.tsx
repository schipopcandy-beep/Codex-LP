'use client'

import { useEffect, useState } from 'react'
import type { AvailableDay } from '@/lib/types'

interface Props {
  selectedDate: string | null
  selectedTime: string | null
  /** 日付・時間を選んだとき（時間がまだ決まっていないときは time を空文字で呼ぶ） */
  onSelect: (date: string, time: string) => void
}

const selectClass =
  'w-full rounded-xl border-2 border-brown-300 bg-white px-3 py-3 text-base font-semibold text-brown-800 disabled:opacity-50'

/** テイクアウトの受け取り日・時間を、プルダウンで選ぶ */
export default function PickupDateTimePicker({ selectedDate, selectedTime, onSelect }: Props) {
  const [days, setDays] = useState<AvailableDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/takeout/schedule')
      .then((r) => r.json())
      .then((data: AvailableDay[]) => {
        setDays(data)
        setLoading(false)
        // 最初は一番近い受け取り日を選んでおく（時間はお客様に選んでもらう）
        if (!selectedDate && data.length > 0) onSelect(data[0].date, '')
      })
      .catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="py-3 text-center text-sm text-brown-400">受取日時を読み込み中...</div>
  }

  if (days.length === 0) {
    return (
      <div className="py-3 text-center text-sm text-amber-700 bg-amber-50 rounded-xl px-3">
        現在、受取可能な日程がありません
      </div>
    )
  }

  const activeDay = days.find((d) => d.date === selectedDate)

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-sm font-semibold text-brown-600 mb-1">受取日</span>
        <select
          value={activeDay?.date ?? ''}
          onChange={(e) => {
            const day = days.find((d) => d.date === e.target.value)
            if (!day) return
            // 同じ時間がその日にもあれば、時間はそのまま
            onSelect(day.date, selectedTime && day.slots.includes(selectedTime) ? selectedTime : '')
          }}
          className={selectClass}
        >
          {!activeDay && <option value="">選んでください</option>}
          {days.map((day) => (
            <option key={day.date} value={day.date}>
              {day.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-semibold text-brown-600 mb-1">受取時間</span>
        <select
          value={activeDay && selectedTime ? selectedTime : ''}
          onChange={(e) => activeDay && onSelect(activeDay.date, e.target.value)}
          disabled={!activeDay}
          className={selectClass}
        >
          <option value="">時間を選んでください</option>
          {activeDay?.slots.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      </label>

      {activeDay && selectedTime && (
        <p className="text-sm text-matcha-700 font-semibold">
          ✓ {activeDay.label} {selectedTime} 受取
        </p>
      )}
    </div>
  )
}
