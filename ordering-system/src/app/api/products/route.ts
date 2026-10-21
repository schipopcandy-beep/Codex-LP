import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { isAllOnigiriSoldOut } from '@/lib/stock'
import { NIGIRI_CATEGORY, isLunchPlate, salesPausedUntil, type Product } from '@/lib/types'

/**
 * 商品一覧
 * 「おにぎり（全体）」の仕込み数を使い切ったときは、おにぎりとランチプレートを売り切れとして返す。
 * ?raw=1 のときは商品ごとの売り切れ設定をそのまま返す（管理画面の売り切れ設定用）
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('raw') === '1'
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 同名・同カテゴリの重複行を除去（DBに重複がある場合の安全策）
  const seen = new Set<string>()
  const unique = (data ?? []).filter((p) => {
    const key = `${p.category}||${p.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (raw) return NextResponse.json(unique)

  // 販売休止中の商品（期間限定で休む商品）は売り切れとして返す
  const shown = unique.map((p) => (salesPausedUntil(p) ? { ...p, is_sold_out: true } : p))

  if (await isAllOnigiriSoldOut(createServiceRoleClient()).catch(() => false)) {
    return NextResponse.json(
      shown.map((p) =>
        p.category === NIGIRI_CATEGORY || isLunchPlate(p as Product) ? { ...p, is_sold_out: true } : p,
      ),
    )
  }

  return NextResponse.json(shown)
}
