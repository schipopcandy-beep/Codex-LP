'use client'

import { useState, use } from 'react'
import OrderAccessGuard from '@/components/customer/OrderAccessGuard'
import OrderUI from '@/components/customer/OrderUI'
import { LEGACY_SEAT_CODES_ENABLED, SEAT_TABLE_IDS } from '@/lib/types'

/**
 * 以前のQRコード用の入口（/table/table-1 など）
 * URLの席名を書き換えるだけで他の卓の注文ができてしまうため、
 * 新しいQRコード（席コード入り）への貼り替えが終わったら使えなくする。
 */
const VALID_TABLE_IDS: readonly string[] = SEAT_TABLE_IDS

interface Props {
  params: Promise<{ tableId: string }>
}

export default function TableOrderPage({ params }: Props) {
  const { tableId } = use(params)
  const [lineUserId, setLineUserId] = useState<string | null>(null)

  if (!LEGACY_SEAT_CODES_ENABLED || !VALID_TABLE_IDS.includes(tableId)) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8 text-center bg-cream-50">
        <div className="max-w-sm space-y-2">
          <p className="text-xl font-bold text-brown-700">お席のQRコードを読み取ってください</p>
          <p className="text-sm text-brown-500">
            店内でのご注文は、各お席に置いてあるQRコードからお願いいたします。
          </p>
        </div>
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
