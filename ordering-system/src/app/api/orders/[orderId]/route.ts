import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/lib/types'

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

  return NextResponse.json(data)
}
