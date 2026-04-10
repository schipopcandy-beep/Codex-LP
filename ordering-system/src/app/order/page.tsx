'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import OrderAccessGuard from '@/components/customer/OrderAccessGuard'
import OrderUI from '@/components/customer/OrderUI'
import { seatToTableId } from '@/lib/types'

function OrderPageContent() {
  const searchParams = useSearchParams()
  const seat = searchParams.get('seat') ?? ''
  const tableId = seatToTableId(seat)

  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [partySize, setPartySize] = useState<number | null>(null)

  // seat が未知・未指定の場合は Guard 側のエラー表示に任せる
  // tableId が null のとき空文字を渡すと Guard が error-no-seat を表示する
  const resolvedTableId = tableId ?? ''

  return (
    <OrderAccessGuard
      tableId={resolvedTableId}
      onUserIdReady={setLineUserId}
      onPartySizeReady={setPartySize}
    >
      <OrderUI
        tableId={resolvedTableId}
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
