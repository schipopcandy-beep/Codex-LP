import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NIGIRI_CATEGORY } from '@/lib/types'

/**
 * おにぎりをまとめて売り切れ／販売中にする
 * body: { is_sold_out: boolean }
 */
export async function POST(req: NextRequest) {
  const body: { is_sold_out?: boolean } = await req.json()
  if (typeof body.is_sold_out !== 'boolean') {
    return NextResponse.json({ error: 'is_sold_out は boolean 必須です' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date()
  const todayJst = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // 状態が変わるものだけ更新する（売り切れ時刻の記録を上書きしないため）
  const { data, error } = await supabase
    .from('products')
    .update({
      is_sold_out: body.is_sold_out,
      updated_at: now.toISOString(),
      sold_out_at: body.is_sold_out ? now.toISOString() : null,
    })
    .eq('category', NIGIRI_CATEGORY)
    .eq('is_sold_out', !body.is_sold_out)
    .select('id, name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 売り切れにした分は、1件ずつ操作したときと同じく履歴に残す
  if (body.is_sold_out && data && data.length > 0) {
    await supabase.from('product_soldout_log').insert(
      data.map((p) => ({
        product_id: p.id,
        product_name: p.name,
        sold_out_at: now.toISOString(),
        date: todayJst,
      })),
    )
  }

  return NextResponse.json({ updated: data?.length ?? 0 })
}
