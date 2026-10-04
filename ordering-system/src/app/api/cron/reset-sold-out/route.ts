import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('products')
    .update({ is_sold_out: false, sold_out_at: null })
    .eq('is_sold_out', true)
    .select('id, name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // おにぎりのオプション（とろろ昆布・漬け卵黄）の売り切れも戻す
  // （表が未作成の場合はエラーになるが、商品のリセットには影響させない）
  await supabase.from('product_options').update({ is_sold_out: false }).eq('is_sold_out', true)

  const count = data?.length ?? 0
  console.log(`[cron] reset-sold-out: ${count}件をリセット`)
  return NextResponse.json({ reset: count, products: data })
}
