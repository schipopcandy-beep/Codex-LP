import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { todayJST } from '@/lib/business-hours'
import { getOptionSoldOut } from '@/lib/options'
import { getStockStatus, LOW_STOCK_THRESHOLD } from '@/lib/stock'
import { OPTION_NAMES, type OptionKey } from '@/lib/types'

/**
 * 管理用: 注文一覧の上に出すお知らせ
 * - 残りわずか: 仕込み数を入れている商品のうち、残りが LOW_STOCK_THRESHOLD 個以下（0個は除く）
 * - 売り切れ: 売り切れになっている商品とオプション
 */
export async function GET() {
  const supabase = createServiceRoleClient()

  const [stock, productsRes, optionSoldOut] = await Promise.all([
    getStockStatus(supabase, todayJST()),
    supabase.from('products').select('name, sort_order, is_sold_out').eq('is_sold_out', true).order('sort_order'),
    getOptionSoldOut(supabase),
  ])

  const soldOutNames = new Set(((productsRes.data ?? []) as { name: string }[]).map((p) => p.name))
  const low = stock
    .filter((s) => s.remaining > 0 && s.remaining <= LOW_STOCK_THRESHOLD && !soldOutNames.has(s.product_name))
    .sort((a, b) => a.remaining - b.remaining)
    .map((s) => ({ name: s.product_name, remaining: s.remaining }))

  const soldOut = [
    ...soldOutNames,
    ...(Object.keys(optionSoldOut) as OptionKey[]).filter((k) => optionSoldOut[k]).map((k) => OPTION_NAMES[k]),
  ]

  return NextResponse.json({ low, soldOut }, { headers: { 'Cache-Control': 'no-store' } })
}
