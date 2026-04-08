'use client'

import { useEffect, useState } from 'react'
import type { AvailableDay } from '@/lib/types'

interface Props {
  selectedDate: string | null
  selectedTime: string | null
  onSelect: (date: string, time: string) => void
}

export default function PickupDateTimePicker({ selectedDate, selectedTime, onSelect }: Props) {
  const [days, setDays] = useState<AvailableDay[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDate, setActiveDate] = useState<string | null>(selectedDate)

  useEffect(() => {
    fetch('/api/takeout/schedule')
      .then((r) => r.json())
      .then((data: AvailableDay[]) => {
        setDays(data)
        // デフォルトで最初の日を選択
        if (!activeDate && data.length > 0) {
          setActiveDate(data[0].date)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeDay = days.find((d) => d.date === activeDate)

  if (loading) {
    return (
      <div className="py-3 text-center text-sm text-brown-400">
        受取日時を読み込み中...
      </div>
    )
  }

  if (days.length === 0) {
    return (
      <div className="py-3 text-center text-sm text-amber-700 bg-amber-50 rounded-xl px-3">
        現在、受取可能な日程がありません
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 日付選択 */}
      <div>
        <p className="text-sm font-semibold text-brown-600 mb-2">受取日</p>
        <div className="flex gap-2 flex-wrap">
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              onClick={() => {
                setActiveDate(day.date)
                // 日付が変わったら時間選択をリセット（別の日のスロットへ）
                if (activeDate !== day.date) {
                  // 時間は未選択に戻す（親へ通知しない）
                }
              }}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                activeDate === day.date
                  ? 'bg-brown-600 text-white border-brown-600'
                  : 'bg-white text-brown-600 border-brown-300 active:bg-cream-100'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* 時間選択 */}
      {activeDay && (
        <div>
          <p className="text-sm font-semibold text-brown-600 mb-2">受取時間</p>
          <div className="flex gap-2 flex-wrap">
            {activeDay.slots.map((slot) => {
              const isSelected = selectedDate === activeDay.date && selectedTime === slot
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onSelect(activeDay.date, slot)}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    isSelected
                      ? 'bg-brown-600 text-white border-brown-600'
                      : 'bg-white text-brown-600 border-brown-300 active:bg-cream-100'
                  }`}
                >
                  {slot}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedDate && selectedTime && (
        <p className="text-sm text-matcha-700 font-semibold">
          ✓ {days.find((d) => d.date === selectedDate)?.label} {selectedTime} 受取
        </p>
      )}
    </div>
  )
}
