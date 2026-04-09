'use client'

import { useState } from 'react'
import TakeoutAccessGuard from '@/components/customer/TakeoutAccessGuard'
import TakeoutUI from '@/components/customer/TakeoutUI'

export default function TakeoutPage() {
  const [lineUserId, setLineUserId] = useState<string | null>(null)

  return (
    <TakeoutAccessGuard onUserIdReady={setLineUserId}>
      <TakeoutUI lineUserId={lineUserId} />
    </TakeoutAccessGuard>
  )
}
