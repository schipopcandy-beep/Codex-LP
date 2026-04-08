'use client'

import { useState } from 'react'
import OrderAccessGuard from '@/components/customer/OrderAccessGuard'
import TakeoutUI from '@/components/customer/TakeoutUI'
import { TAKEOUT_TABLE_ID } from '@/lib/types'

export default function TakeoutPage() {
  const [lineUserId, setLineUserId] = useState<string | null>(null)

  return (
    <OrderAccessGuard
      tableId={TAKEOUT_TABLE_ID}
      onUserIdReady={setLineUserId}
    >
      <TakeoutUI lineUserId={lineUserId} />
    </OrderAccessGuard>
  )
}
