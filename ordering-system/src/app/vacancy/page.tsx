'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { storageUrl } from '@/lib/types'

interface SeatGroup {
  total: number
  occupied: number
  vacant: number
}

interface Vacancy {
  total: number
  occupied: number
  vacant: number
  table: SeatGroup
  counter: SeatGroup
}

export default function VacancyPage() {
  const [data, setData] = useState<Vacancy | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string>('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/vacancy', { cache: 'no-store' })
      if (res.ok) {
        setData(await res.json())
        setUpdatedAt(
          new Date().toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo',
          }),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  const isFull = data ? data.vacant === 0 : false

  return (
    <div className="min-h-dvh bg-cream-50 flex flex-col">
      <header className="bg-cream-50/95 backdrop-blur border-b border-cream-300 px-4 py-2 flex justify-center">
        <Image
          src={storageUrl('logo.png')}
          alt="織はや"
          width={120}
          height={48}
          className="object-contain h-10 w-auto"
        />
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 flex flex-col items-center justify-center gap-8">
        <h1 className="section-title text-2xl">ただいまの空席状況</h1>

        {loading ? (
          <p className="text-brown-400 text-lg py-12">確認中...</p>
        ) : !data ? (
          <p className="text-brown-400 text-lg py-12">状況を取得できませんでした</p>
        ) : (
          <>
            {/* 満席時のみ案内 */}
            {isFull && (
              <div className="w-full rounded-3xl border-2 bg-red-50 border-red-200 p-6 text-center">
                <p className="text-xl font-bold text-red-500 mb-2">満席です</p>
                <p className="text-sm text-brown-500">
                  申し訳ございません。<br />
                  少々お待ちいただく場合がございます。
                </p>
              </div>
            )}

            {/* 席種別ごとの空席数 */}
            <div className="w-full grid grid-cols-2 gap-3">
              <SeatGroupCard label="テーブル" group={data.table} unit="卓" />
              <SeatGroupCard label="カウンター" group={data.counter} unit="席" />
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={load}
                className="btn-primary px-8 py-2.5 text-base"
              >
                最新の状況に更新
              </button>
              {updatedAt && (
                <p className="text-xs text-brown-400">最終更新 {updatedAt}（30秒ごとに自動更新）</p>
              )}
            </div>

            <p className="text-xs text-brown-400 text-center leading-relaxed">
              ※ ご注文状況をもとにした目安です。<br />
              実際の空席と異なる場合がございます。
            </p>
          </>
        )}
      </main>
    </div>
  )
}

function SeatGroupCard({ label, group, unit }: { label: string; group: SeatGroup; unit: string }) {
  const isFull = group.vacant === 0
  return (
    <div className="card p-5 text-center">
      <p className="text-sm font-semibold text-brown-600 mb-3">{label}</p>
      {isFull ? (
        <p className="text-2xl font-bold text-red-400 leading-none py-2">満席</p>
      ) : (
        <p className="text-4xl font-bold text-matcha-600 tabular-nums leading-none">
          {group.vacant}
          <span className="text-base text-brown-400 ml-0.5">/ {group.total}{unit}</span>
        </p>
      )}
      <p className="text-xs text-brown-400 mt-2">空き{unit}数</p>
    </div>
  )
}
