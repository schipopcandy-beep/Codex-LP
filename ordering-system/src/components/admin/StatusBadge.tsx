import type { OrderStatus } from '@/lib/types'
import { getStatusLabel } from '@/lib/types'

const STATUS_STYLES: Record<OrderStatus, string> = {
  new: 'bg-amber-100 text-amber-800 border border-amber-300',
  added: 'bg-rose-100 text-rose-800 border border-rose-300',
  preparing: 'bg-blue-100 text-blue-800 border border-blue-300',
  served: 'bg-green-100 text-green-800 border border-green-300',
  paid: 'bg-gray-100 text-gray-600 border border-gray-300',
}

interface Props {
  status: OrderStatus
  size?: 'sm' | 'md'
  tableId?: string
  /** ラベルの末尾に添える文字（追加注文の回数など） */
  suffix?: string
}

export default function StatusBadge({ status, size = 'md', tableId, suffix }: Props) {
  const sizeClass = size === 'sm' ? 'text-sm px-2 py-0.5' : 'text-base px-3 py-1'
  return (
    <span className={`inline-block rounded-full font-bold ${sizeClass} ${STATUS_STYLES[status]}`}>
      {getStatusLabel(status, tableId)}{suffix ?? ''}
    </span>
  )
}
