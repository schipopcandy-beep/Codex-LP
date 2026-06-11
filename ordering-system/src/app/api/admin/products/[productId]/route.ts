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
  const now = new Date()
  const jstOffset = 9 * 60 * 60 * 1000
  const nowJst = new Date(now.getTime() + jstOffset)
  const todayJst = nowJst.toISOString().slice(0, 10)

  const updateData: Record<string, unknown> = {
    is_sold_out: body.is_sold_out,
    updated_at: now.toISOString(),
    sold_out_at: body.is_sold_out ? now.toISOString() : null,
  }

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 売り切れにした場合は履歴ログに記録
  if (body.is_sold_out && data) {
    await supabase.from('product_soldout_log').insert({
      product_id: productId,
      product_name: data.name,
      sold_out_at: now.toISOString(),
      date: todayJst,
    })
  }

  return NextResponse.json(data)
}
