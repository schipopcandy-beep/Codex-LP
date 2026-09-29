'use client'

import { Suspense, useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import TakeoutAccessGuard from '@/components/customer/TakeoutAccessGuard'
import TakeoutUI from '@/components/customer/TakeoutUI'
import { seatToTableId } from '@/lib/types'

function TakeoutPageContent() {
  const searchParams = useSearchParams()
  const seat = searchParams.get('seat') ?? ''
  // 席から来た場合は、その卓の伝票にお持ち帰り分として加える
  const seatTableId = seat ? seatToTableId(seat) : null

  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [lineDisplayName, setLineDisplayName] = useState<string | null>(null)

  const handleUserIdReady = useCallback((userId: string, displayName?: string) => {
    setLineUserId(userId)
    setLineDisplayName(displayName ?? null)
  }, [])

  return (
    <TakeoutAccessGuard onUserIdReady={handleUserIdReady}>
      <TakeoutUI
        lineUserId={lineUserId}
        lineDisplayName={lineDisplayName}
        seat={seat || undefined}
        seatTableId={seatTableId}
      />
    </TakeoutAccessGuard>
  )
}

export default function TakeoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-cream-50">
          <div className="w-10 h-10 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin" />
          <p className="text-brown-500 text-base">読み込み中...</p>
        </div>
      }
    >
      <TakeoutPageContent />
    </Suspense>
  )
}
