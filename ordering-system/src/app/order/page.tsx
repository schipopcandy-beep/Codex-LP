'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import OrderAccessGuard from '@/components/customer/OrderAccessGuard'
import OrderUI from '@/components/customer/OrderUI'
import { seatToTableId, storageUrl } from '@/lib/types'

// テーブル選択画面
// LIFFリンクからseat未指定で来た場合に表示する
const SEAT_LABELS: { seat: string; label: string }[] = [
  { seat: 't1', label: 'テーブル 1' },
  { seat: 't2', label: 'テーブル 2' },
  { seat: 't3', label: 'テーブル 3' },
  { seat: 't4', label: 'テーブル 4' },
  { seat: 'c1', label: 'カウンター 1' },
  { seat: 'c2', label: 'カウンター 2' },
  { seat: 'c3', label: 'カウンター 3' },
  { seat: 'c4', label: 'カウンター 4' },
]

function SeatSelectScreen() {
  const router = useRouter()

  return (
    <div className="min-h-dvh bg-cream-50 flex flex-col">
      <header className="border-b border-cream-300 px-4 py-3 flex items-center justify-center">
        <Image
          src={storageUrl('logo.png')}
          alt="織はや"
          width={120}
          height={48}
          className="object-contain h-10 w-auto"
        />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8 max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <p className="text-3xl mb-3">🍙</p>
          <h1 className="text-xl font-bold text-brown-800 mb-2">お座りの席を選んでください</h1>
          <p className="text-sm text-brown-400">席番号はテーブルのプレートで確認できます</p>
        </div>

        <div className="w-full space-y-4">
          <div>
            <p className="text-xs font-bold text-brown-400 uppercase tracking-wide mb-2 px-1">テーブル席</p>
            <div className="grid grid-cols-2 gap-3">
              {SEAT_LABELS.filter((s) => s.seat.startsWith('t')).map((s) => (
                <button
                  key={s.seat}
                  onClick={() => router.push(`/order?seat=${s.seat}`)}
                  className="py-4 rounded-2xl bg-white border-2 border-cream-300 text-brown-800 font-bold text-base active:bg-cream-100 active:border-brown-500 transition-colors shadow-sm"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-brown-400 uppercase tracking-wide mb-2 px-1">カウンター席</p>
            <div className="grid grid-cols-2 gap-3">
              {SEAT_LABELS.filter((s) => s.seat.startsWith('c')).map((s) => (
                <button
                  key={s.seat}
                  onClick={() => router.push(`/order?seat=${s.seat}`)}
                  className="py-4 rounded-2xl bg-white border-2 border-cream-300 text-brown-800 font-bold text-base active:bg-cream-100 active:border-brown-500 transition-colors shadow-sm"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => router.push('/takeout')}
              className="w-full py-3 rounded-2xl border-2 border-brown-400 text-brown-700 font-semibold text-sm active:bg-cream-100 transition-colors"
            >
              テイクアウトで注文する →
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function OrderPageContent() {
  const searchParams = useSearchParams()
  const seat = searchParams.get('seat') ?? ''
  const tableId = seatToTableId(seat)

  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [partySize, setPartySize] = useState<number | null>(null)

  // seat未指定 → テーブル選択画面を表示
  if (!seat || !tableId) {
    return <SeatSelectScreen />
  }

  return (
    <OrderAccessGuard
      tableId={tableId}
      onUserIdReady={setLineUserId}
      onPartySizeReady={setPartySize}
    >
      <OrderUI
        tableId={tableId}
        lineUserId={lineUserId}
        partySize={partySize}
        buildCompleteHref={(orderId) =>
          `/order/complete?seat=${encodeURIComponent(seat)}&orderId=${encodeURIComponent(orderId)}`
        }
      />
    </OrderAccessGuard>
  )
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-cream-50">
          <div className="w-10 h-10 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin" />
          <p className="text-brown-500 text-base">読み込み中...</p>
        </div>
      }
    >
      <OrderPageContent />
    </Suspense>
  )
}
