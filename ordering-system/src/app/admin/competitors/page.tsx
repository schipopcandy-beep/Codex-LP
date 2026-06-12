'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

interface Shop {
  id: string
  name: string
  open_weekdays: number[]
  today_open: boolean
  today_override: boolean
  today_default: boolean
}

interface DayStatus {
  date: string
  dow: number
  default_open: boolean
  override: boolean | null
  is_open: boolean
}

interface CalendarData {
  shop: { id: string; name: string; open_weekdays: number[] }
  days: DayStatus[]
}

export default function CompetitorsPage() {
  const now = new Date()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [openShopId, setOpenShopId] = useState<string | null>(null)
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [calendar, setCalendar] = useState<CalendarData | null>(null)
  const [calLoading, setCalLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const nowYear  = now.getFullYear()
  const nowMonth = now.getMonth() + 1

  const fetchShops = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/competitors')
    if (res.ok) setShops(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchShops() }, [fetchShops])

  const fetchCalendar = useCallback(async (shopId: string, year: number, month: number) => {
    setCalLoading(true)
    const res = await fetch(`/api/admin/competitors/${shopId}/status?year=${year}&month=${month}`)
    if (res.ok) setCalendar(await res.json())
    setCalLoading(false)
  }, [])

  const openCalendar = (shopId: string) => {
    if (openShopId === shopId) { setOpenShopId(null); return }
    setOpenShopId(shopId)
    setCalYear(nowYear)
    setCalMonth(nowMonth)
    fetchCalendar(shopId, nowYear, nowMonth)
  }

  const navigateMonth = (delta: number) => {
    if (!openShopId) return
    let y = calYear, m = calMonth + delta
    if (m < 1) { y -= 1; m = 12 }
    if (m > 12) { y += 1; m = 1 }
    setCalYear(y)
    setCalMonth(m)
    fetchCalendar(openShopId, y, m)
  }

  const toggleToday = async (shop: Shop) => {
    const jstOffset = 9 * 60 * 60 * 1000
    const todayJst = new Date(Date.now() + jstOffset).toISOString().slice(0, 10)
    setToggling(shop.id)
    await fetch(`/api/admin/competitors/${shop.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayJst, is_open: !shop.today_open }),
    })
    await fetchShops()
    if (openShopId === shop.id) fetchCalendar(shop.id, calYear, calMonth)
    setToggling(null)
  }

  const toggleDay = async (day: DayStatus) => {
    if (!openShopId) return
    setToggling(day.date)
    await fetch(`/api/admin/competitors/${openShopId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: day.date, is_open: !day.is_open }),
    })
    await fetchCalendar(openShopId, calYear, calMonth)
    await fetchShops()
    setToggling(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-brown-500 hover:text-brown-700 text-base">← 一覧</Link>
        <h1 className="section-title text-2xl">競合店管理</h1>
      </div>

      {loading ? (
        <div className="text-center py-16 text-brown-400">読み込み中...</div>
      ) : (
        <div className="space-y-4">
          {/* 今日の状況 */}
          <div className="card p-4">
            <h2 className="font-bold text-brown-700 mb-3">今日の状況</h2>
            <div className="space-y-2">
              {shops.map((shop) => (
                <div key={shop.id} className="flex items-center gap-3">
                  <span className={`text-lg ${shop.today_open ? 'text-green-500' : 'text-red-400'}`}>
                    {shop.today_open ? '●' : '○'}
                  </span>
                  <span className="flex-1 text-sm font-medium text-brown-800">{shop.name}</span>
                  {shop.today_override && (
                    <span className="text-xs text-amber-500 shrink-0">手動変更</span>
                  )}
                  <button
                    onClick={() => toggleToday(shop)}
                    disabled={toggling === shop.id}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors shrink-0 ${
                      shop.today_open
                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                    }`}
                  >
                    {shop.today_open ? '休業に変更' : '営業に変更'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 月間スケジュール */}
          {shops.map((shop) => (
            <div key={shop.id} className="card overflow-hidden">
              <button
                onClick={() => openCalendar(shop.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-cream-100 transition-colors"
              >
                <div>
                  <p className="font-bold text-brown-800">{shop.name}</p>
                  <p className="text-xs text-brown-500 mt-0.5">
                    通常営業: {shop.open_weekdays.sort((a, b) => a - b).map(d => DOW_LABELS[d]).join('・')}
                  </p>
                </div>
                <span className="text-brown-400 text-lg">{openShopId === shop.id ? '▲' : '▼'}</span>
              </button>

              {openShopId === shop.id && (
                <div className="border-t border-cream-200 p-4">
                  {/* 月ナビ */}
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => navigateMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-cream-200 hover:bg-cream-300 text-brown-600 font-bold">◀</button>
                    <span className="font-bold text-brown-700 tabular-nums">{calYear}年{calMonth}月</span>
                    <button
                      onClick={() => navigateMonth(1)}
                      disabled={calYear >= nowYear && calMonth >= nowMonth}
                      className={`w-8 h-8 flex items-center justify-center rounded-full font-bold transition-colors ${
                        calYear < nowYear || calMonth < nowMonth
                          ? 'bg-cream-200 hover:bg-cream-300 text-brown-600'
                          : 'bg-cream-100 text-brown-300 cursor-not-allowed'
                      }`}
                    >▶</button>
                  </div>

                  {calLoading ? (
                    <div className="text-center py-6 text-brown-400 text-sm">読み込み中...</div>
                  ) : calendar && (
                    <>
                      {/* 凡例 */}
                      <div className="flex gap-3 mb-3 text-xs text-brown-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block" />営業</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-50 border border-red-200 inline-block" />休業</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-50 border-2 border-amber-400 inline-block" />手動変更</span>
                      </div>

                      {/* カレンダーグリッド */}
                      <div className="grid grid-cols-7 gap-1">
                        {DOW_LABELS.map((d, i) => (
                          <div key={d} className={`text-center text-xs py-1 font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-brown-500'}`}>{d}</div>
                        ))}
                        {/* 月初の空白 */}
                        {Array(new Date(calYear, calMonth - 1, 1).getDay()).fill(null).map((_, i) => (
                          <div key={`blank-${i}`} />
                        ))}
                        {calendar.days.map((day) => {
                          const d = parseInt(day.date.split('-')[2])
                          const isOverride = day.override !== null
                          const isToday = day.date === new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
                          return (
                            <button
                              key={day.date}
                              onClick={() => toggleDay(day)}
                              disabled={toggling === day.date}
                              className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center relative transition-colors
                                ${day.is_open
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-50 text-red-400 hover:bg-red-100'}
                                ${isOverride ? 'ring-2 ring-amber-400' : ''}
                                ${isToday ? 'ring-2 ring-brown-500' : ''}
                              `}
                            >
                              {d}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
