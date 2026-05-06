import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/lib/types'

const LINE_HARNESS_URL = process.env.LINE_HARNESS_URL ?? 'https://line-harness.schi-popcandy.workers.dev'
const LINE_HARNESS_KEY = process.env.LINE_HARNESS_API_KEY ?? 'sk-line-harness-2026'

async function incrementVisitCount(lineUserId: string, tableId: string) {
  try {
    // Look up friend by LINE user ID
    const searchRes = await fetch(
      `${LINE_HARNESS_URL}/api/friends?lineUserId=${encodeURIComponent(lineUserId)}&limit=1`,
      { headers: { Authorization: `Bearer ${LINE_HARNESS_KEY}` } },
    )
    if (!searchRes.ok) return
    const searchData = await searchRes.json() as { success: boolean; data: { items: { id: string; metadata: Record<string, unknown> }[] } }
    const friend = searchData.data?.items?.[0]
    if (!friend) return

    // Determine which counter to increment
    const isEatein = tableId !== 'takeout'
    const key = isEatein ? 'eatein_visits' : 'takeout_visits'
    const current = typeof friend.metadata[key] === 'number' ? (friend.metadata[key] as number) : 0

    await fetch(`${LINE_HARNESS_URL}/api/friends/${friend.id}/metadata`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${LINE_HARNESS_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ [key]: current + 1 }),
    })
  } catch (err) {
    console.error('incrementVisitCount error:', err)
  }
}

interface Params {
  params: Promise<{ orderId: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      table:tables(*),
      order_items(
        *,
        product:products(*)
      )
    `)
    .eq('id', orderId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orderId } = await params
  const body: { status: OrderStatus } = await req.json()

  const validStatuses: OrderStatus[] = ['new', 'preparing', 'served', 'paid']
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('orders')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Track visit count in LINE Harness when order is marked as paid
  if (body.status === 'paid' && data.line_user_id && data.table_id) {
    void incrementVisitCount(data.line_user_id, data.table_id)
  }

  return NextResponse.json(data)
}
