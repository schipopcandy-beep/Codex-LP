'use client'

import { useState, use } from 'react'
import OrderAccessGuard from '@/components/customer/OrderAccessGuard'
import OrderUI from '@/components/customer/OrderUI'

const VALID_TABLE_IDS = [
  'table-1', 'table-2', 'table-3', 'table-4',
  'counter-1', 'counter-2', 'counter-3', 'counter-4',
]

interface Props {
  params: Promise<{ tableId: string }>
}

export default function TableOrderPage({ params }: Props) {
  const { tableId } = use(params)
  const [lineUserId, setLineUserId] = useState<string | null>(null)

  if (!VALID_TABLE_IDS.includes(tableId)) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center">
        <p className="text-xl text-brown-600">無効な席IDです</p>
      </div>
    )
  }

  return (
    <OrderAccessGuard tableId={tableId} onUserIdReady={setLineUserId}>
      <OrderUI
        tableId={tableId}
        lineUserId={lineUserId}
        buildCompleteHref={(orderId) =>
          `/table/${tableId}/complete?orderId=${encodeURIComponent(orderId)}`
        }
      />
    </OrderAccessGuard>
  )
}
