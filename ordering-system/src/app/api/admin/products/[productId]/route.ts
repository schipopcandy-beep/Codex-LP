import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

interface Params {
  params: Promise<{ productId: string }>
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { productId } = await params
  const body: { is_sold_out?: boolean } = await req.json()

  if (typeof body.is_sold_out !== 'boolean') {
    return NextResponse.json({ error: 'is_sold_out は boolean 必須です' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('products')
    .update({
      is_sold_out: body.is_sold_out,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
