import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { todayJST } from '@/lib/business-hours'
import { getStockStatus, syncAutoSoldOut } from '@/lib/stock'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 管理用: 指定日（既定は今日）の仕込み数と残り数。?date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? todayJST()
  if (!DATE_RE.test(date)) return NextResponse.json({ error: '日付の形式が正しくありません' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const items = await getStockStatus(supabase, date)
  return NextResponse.json({ date, items }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * 管理用: 仕込み数を登録・変更する
 * body: { date, product_id, prepared_qty }（prepared_qty が null なら数の管理をやめる）
 */
export async function PUT(req: NextRequest) {
  const body: { date?: string; product_id?: string; prepared_qty?: number | null } = await req.json()
  const date = body.date ?? todayJST()
  if (!DATE_RE.test(date) || !body.product_id) {
    return NextResponse.json({ error: 'date と product_id は必須です' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  if (body.prepared_qty == null) {
    const { error } = await supabase
      .from('product_stock')
      .delete()
      .eq('date', date)
      .eq('product_id', body.product_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const qty = Number(body.prepared_qty)
    if (!Number.isInteger(qty) || qty < 0) {
      return NextResponse.json({ error: '仕込み数は0以上の整数で入力してください' }, { status: 400 })
    }
    const { error } = await supabase.from('product_stock').upsert(
      { date, product_id: body.product_id, prepared_qty: qty, updated_at: new Date().toISOString() },
      { onConflict: 'date,product_id' },
    )
    if (error) {
      return NextResponse.json(
        { error: `${error.message}（仕込み数の表が未作成の場合は、案内したSQLを実行してください）` },
        { status: 500 },
      )
    }
  }

  // 仕込み数を変えたら、今日の売り切れ表示を合わせる
  await syncAutoSoldOut(supabase, date)

  const items = await getStockStatus(supabase, date)
  return NextResponse.json({ date, items })
}
