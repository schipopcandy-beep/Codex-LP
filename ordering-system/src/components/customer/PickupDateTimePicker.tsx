'use client'

import { useEffect, useState } from 'react'
import type { AvailableDay } from '@/lib/types'

interface Props {
  selectedDate: string | null
  selectedTime: string | null
  /** 日付・時間を選んだとき（時間がまだ決まっていないときは time を空文字で呼ぶ） */
  onSelect: (date: string, time: string) => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** "YYYY-MM" の月の日付（YYYY-MM-DD）を、カレンダーの並び（先頭の空白は null）で返す */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number)
  const firstWeekday = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]
}

/** "YYYY-MM" を n か月ずらす */
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** テイクアウトの受け取り日をカレンダーで、時間をプルダウンで選ぶ */
export default function PickupDateTimePicker({ selectedDate, selectedTime, onSelect }: Props) {
  const [days, setDays] = useState<AvailableDay[]>([])
  const [loading, setLoading] = useState(true)
  /** 表示している月（YYYY-MM） */
  const [month, setMonth] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/takeout/schedule')
      .then((r) => r.json())
      .then((data: AvailableDay[]) => {
        setDays(data)
        setLoading(false)
        if (data.length > 0) {
          setMonth((selectedDate ?? data[0].date).slice(0, 7))
          // 最初は一番近い受け取り日を選んでおく（時間はお客様に選んでもらう）
          if (!selectedDate) onSelect(data[0].date, '')
        }
      })
      .catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="py-3 text-center text-sm text-brown-400">受取日時を読み込み中...</div>
  }

  if (days.length === 0 || !month) {
    return (
      <div className="py-3 text-center text-sm text-amber-700 bg-amber-50 rounded-xl px-3">
        現在、受取可能な日程がありません
      </div>
    )
  }

  const available = new Map(days.map((d) => [d.date, d]))
  const firstMonth = days[0].date.slice(0, 7)
  const lastMonth = days[days.length - 1].date.slice(0, 7)
  const activeDay = selectedDate ? available.get(selectedDate) : undefined

  const pickDate = (date: string) => {
    const day = available.get(date)
    if (!day) return
    // 同じ時間がその日にもあれば、時間はそのまま
    onSelect(date, selectedTime && day.slots.includes(selectedTime) ? selectedTime : '')
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-sm font-semibold text-brown-600 mb-1">受取日</span>
        <div className="rounded-2xl border-2 border-cream-300 bg-white p-3">
          {/* 月の切り替え */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              disabled={month <= firstMonth}
              className="w-9 h-9 rounded-full text-brown-600 text-lg font-bold disabled:opacity-20 active:bg-cream-100"
              aria-label="前の月"
            >
              ‹
            </button>
            <p className="font-bold text-brown-800">
              {Number(month.slice(0, 4))}年{Number(month.slice(5, 7))}月
            </p>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month >= lastMonth}
              className="w-9 h-9 rounded-full text-brown-600 text-lg font-bold disabled:opacity-20 active:bg-cream-100"
              aria-label="次の月"
            >
              ›
            </button>
          </div>

          {/* 曜日 */}
          <div className="grid grid-cols-7 text-center text-xs font-bold mb-1">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-brown-500'}>
                {w}
              </span>
            ))}
          </div>

          {/* 日付（予約できる日だけ押せる） */}
          <div className="grid grid-cols-7 gap-1">
            {monthCells(month).map((date, i) => {
              if (!date) return <span key={`blank-${i}`} />
              const isAvailable = available.has(date)
              const isSelected = date === selectedDate
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => pickDate(date)}
                  disabled={!isAvailable}
                  aria-pressed={isSelected}
                  className={`aspect-square rounded-xl text-sm font-bold tabular-nums ${
                    isSelected
                      ? 'bg-brown-600 text-white'
                      : isAvailable
                        ? 'bg-cream-100 text-brown-800 active:bg-cream-200'
                        : 'text-brown-200'
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-brown-400 mt-2">※ 薄い日付はお休み、または予約できない日です</p>
        </div>
      </div>

      <label className="block">
        <span className="block text-sm font-semibold text-brown-600 mb-1">受取時間</span>
        <select
          value={activeDay && selectedTime ? selectedTime : ''}
          onChange={(e) => activeDay && onSelect(activeDay.date, e.target.value)}
          disabled={!activeDay}
          className="w-full rounded-xl border-2 border-brown-300 bg-white px-3 py-3 text-base font-semibold text-brown-800 disabled:opacity-50"
        >
          <option value="">{activeDay ? '時間を選んでください' : '先に受取日を選んでください'}</option>
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
