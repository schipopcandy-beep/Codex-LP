'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import OrderAccessGuard from '@/components/customer/OrderAccessGuard'
import OrderUI from '@/components/customer/OrderUI'
import { seatToTableId, storageUrl } from '@/lib/types'

/**
 * 席が特定できないときの案内
 * 他の卓を選んで注文できないよう、席を選ぶ画面は出さない
 */
function ScanQrScreen() {
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

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-4">
        <p className="text-3xl">🍙</p>
        <h1 className="text-xl font-bold text-brown-800">お席のQRコードを読み取ってください</h1>
        <p className="text-sm text-brown-500 leading-relaxed">
          店内でのご注文は、各お席に置いてあるQRコードからお願いいたします。
        </p>
        <a
          href="/takeout"
          className="block w-full py-3 rounded-2xl border-2 border-brown-400 text-brown-700 font-semibold text-sm active:bg-cream-100"
        >
          テイクアウトのご注文はこちら →
        </a>
      </main>
    </div>
  )
}

/**
 * URLから席コードを取り出す
 * LINEアプリ経由（LIFFのURL）で開くと、最初は ?liff.state=%3Fseat%3D... の形で届き、
 * LINEの初期化のあとで ?seat=... に置き換わる。初期化が動くよう、どちらからも読む。
 */
function readSeatCode(searchParams: URLSearchParams): string {
  const direct = searchParams.get('seat')
  if (direct) return direct

  const liffState = searchParams.get('liff.state')
  if (!liffState) return ''
  const query = liffState.includes('?') ? liffState.slice(liffState.indexOf('?') + 1) : liffState
  return new URLSearchParams(query).get('seat') ?? ''
}

function OrderPageContent() {
  const searchParams = useSearchParams()
  const seat = readSeatCode(new URLSearchParams(searchParams.toString()))
  const tableId = seatToTableId(seat)

  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [partySize, setPartySize] = useState<number | null>(null)

  if (!seat || !tableId) {
    return <ScanQrScreen />
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
